import Database from 'better-sqlite3'
import { randomUUID, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
import { scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export type UserRole = 'admin' | 'operator' | 'viewer'

export interface UserRecord {
  id: string
  username: string
  role: UserRole
  mustChangePassword: boolean
  createdAt: number
  updatedAt: number
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export class UserStore {
  /** Resolves when the initial admin seed (if needed) has completed. */
  readonly ready: Promise<void>

  constructor(private db: Database.Database, private secret: string) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id                   TEXT PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        role                 TEXT NOT NULL DEFAULT 'operator',
        password_hash        TEXT NOT NULL,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL
      )
    `)
    // Migration: add must_change_password to existing installs
    try { this.db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0') } catch {}

    // First-run: seed default admin account if no users exist.
    // Expose a `ready` promise so the server can await seeding before
    // accepting login requests (prevents "Invalid credentials" on cold start).
    this.ready = this.hasUsers
      ? Promise.resolve()
      : this.create('admin', 'admin', 'admin', true).then(() => {})
  }

  get hasUsers(): boolean {
    return ((this.db.prepare('SELECT COUNT(*) as n FROM users').get() as any).n as number) > 0
  }

  list(): UserRecord[] {
    return (this.db.prepare('SELECT * FROM users ORDER BY created_at').all() as any[]).map(this.toRecord)
  }

  get(id: string): UserRecord | undefined {
    const r = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
    return r ? this.toRecord(r) : undefined
  }

  getByUsername(username: string): any | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
  }

  async create(username: string, password: string, role: UserRole = 'operator', mustChangePassword = false): Promise<UserRecord> {
    const now = Date.now()
    const id = randomUUID()
    const hash = await this.hashPassword(password)
    this.db.prepare(`
      INSERT INTO users (id, username, role, password_hash, must_change_password, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, role, hash, mustChangePassword ? 1 : 0, now, now)
    return this.get(id)!
  }

  async update(
    id: string,
    data: Partial<{ username: string; role: UserRole; password: string }>,
  ): Promise<UserRecord | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username) }
    if (data.role     !== undefined) { fields.push('role = ?');     values.push(data.role) }
    if (data.password !== undefined) {
      fields.push('password_hash = ?')
      values.push(await this.hashPassword(data.password))
      // Changing password clears the must-change flag
      fields.push('must_change_password = ?')
      values.push(0)
    }
    if (!fields.length) return this.get(id)
    fields.push('updated_at = ?')
    values.push(Date.now(), id)
    this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id)
  }

  async verifyPassword(username: string, password: string): Promise<UserRecord | null> {
    const r = this.getByUsername(username)
    if (!r) return null
    const colonIdx = r.password_hash.indexOf(':')
    if (colonIdx === -1) return null
    const salt = r.password_hash.slice(0, colonIdx)
    const storedHash = r.password_hash.slice(colonIdx + 1)
    const derived = (await scryptAsync(password, salt, 64)) as Buffer
    const expected = Buffer.from(storedHash, 'hex')
    if (derived.length !== expected.length) return null
    if (!timingSafeEqual(derived, expected)) return null
    return this.toRecord(r)
  }

  /** Returns a signed session token: u:userId:role:expiry:nonce:sig */
  createSessionToken(user: UserRecord): string {
    const expiry = Date.now() + SESSION_TTL_MS
    const nonce = randomBytes(16).toString('hex')
    const payload = `${user.id}:${user.role}:${expiry}:${nonce}`
    const sig = createHmac('sha256', this.secret).update(payload).digest('hex')
    return `u:${payload}:${sig}`
  }

  /** Returns { userId, role } if token is valid, null otherwise */
  verifySessionToken(token: string): { userId: string; role: UserRole } | null {
    try {
      if (!token.startsWith('u:')) return null
      const rest = token.slice(2)
      const lastColon = rest.lastIndexOf(':')
      if (lastColon === -1) return null
      const payload = rest.slice(0, lastColon)
      const sig = rest.slice(lastColon + 1)
      // payload = userId:role:expiry:nonce
      // UUID contains no colons, so parts[0] is the full UUID
      const parts = payload.split(':')
      if (parts.length < 4) return null
      const [userId, role, expiry] = parts
      if (Date.now() > Number(expiry)) return null
      const expected = createHmac('sha256', this.secret).update(payload).digest('hex')
      const a = Buffer.from(sig, 'hex')
      const b = Buffer.from(expected, 'hex')
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null
      return { userId, role: role as UserRole }
    } catch {
      return null
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(32).toString('hex')
    const hash = ((await scryptAsync(password, salt, 64)) as Buffer).toString('hex')
    return `${salt}:${hash}`
  }

  private toRecord(r: any): UserRecord {
    return {
      id: r.id,
      username: r.username,
      role: r.role as UserRole,
      mustChangePassword: Boolean(r.must_change_password),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
