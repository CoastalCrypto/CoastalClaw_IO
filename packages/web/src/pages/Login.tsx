import { useState } from 'react'
import { coreClient } from '../api/client'

interface Props {
  setupMode: boolean
  onLogin: (sessionToken: string, user: { id: string; username: string; role: string }) => void | Promise<void>
}

export function Login({ setupMode, onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const inp = 'w-full bg-black/40 border border-white/10 text-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/60 placeholder-gray-600'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (setupMode && password !== confirm) { setError('Passwords do not match'); return }
    if (setupMode && password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { sessionToken, user } = setupMode
        ? await coreClient.setupFirstUser(username, password)
        : await coreClient.loginUser(username, password)
      onLogin(sessionToken, user)
    } catch (e: any) {
      setError(e.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="font-mono text-2xl text-cyan-400 tracking-widest mb-2">{'>'} COASTAL_OS</div>
          <div className="text-xs font-mono text-gray-500 tracking-wider">
            {setupMode ? 'CREATE YOUR ADMIN ACCOUNT' : 'SIGN IN TO CONTINUE'}
          </div>
        </div>

        <form onSubmit={handleSubmit}
          className="rounded-2xl border border-white/8 p-8"
          style={{ background: 'rgba(10,22,40,0.8)', backdropFilter: 'blur(16px)' }}>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-mono tracking-wider">USERNAME</label>
              <input className={inp} value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username" autoComplete="username" autoFocus required />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-mono tracking-wider">PASSWORD</label>
              <input className={inp} type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete={setupMode ? 'new-password' : 'current-password'} required />
            </div>

            {setupMode && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-mono tracking-wider">CONFIRM PASSWORD</label>
                <input className={inp} type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" autoComplete="new-password" required />
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 font-mono">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !username || !password}
            className="mt-6 w-full btn-primary py-3 text-sm disabled:opacity-40">
            {loading ? 'Please wait...' : setupMode ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {setupMode && (
          <p className="text-center text-xs text-gray-600 mt-6 font-mono">
            This is your first login — you're creating the root admin account.
          </p>
        )}
      </div>
    </div>
  )
}
