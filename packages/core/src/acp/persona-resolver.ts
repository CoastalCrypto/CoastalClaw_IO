// Resolves which Coastal agent domain handles an ACP session.
//
// Strategy: env-var pin wins; otherwise classify the first user prompt
// against keyword sets, falling back to 'general' on no match. Once a
// session has been resolved, the choice is locked for the rest of that
// session — switching personas mid-conversation breaks the IDE user's
// mental model and discards the system-prompt-shaped context.

export type Domain = 'coo' | 'cfo' | 'cto' | 'general'

const VALID: ReadonlySet<Domain> = new Set(['coo', 'cfo', 'cto', 'general'])

export function readEnvPin(env: NodeJS.ProcessEnv = process.env): Domain | null {
  const raw = env.COASTAL_ACP_PERSONA?.trim().toLowerCase()
  return raw && VALID.has(raw as Domain) ? (raw as Domain) : null
}

const KEYWORDS: Record<Exclude<Domain, 'general'>, RegExp> = {
  cfo: /\b(budget|cash|invoice|financ|forecast|revenue|profit|compliance|risk|audit|spend)\b/,
  cto: /\b(code|deploy|architect|infra|secur|ci|api|database|docker|cloud|stack|bug|repo|test|build|lint|refactor)\b/,
  coo: /\b(team|hire|operat|workflow|process|logistics|resource|schedul|meeting|staff|onboard)\b/,
}

export function classifyPrompt(message: string): Domain {
  const m = message.toLowerCase()
  if (KEYWORDS.cfo.test(m)) return 'cfo'
  if (KEYWORDS.cto.test(m)) return 'cto'
  if (KEYWORDS.coo.test(m)) return 'coo'
  return 'general'
}

export function resolveDomain(firstPrompt: string, env: NodeJS.ProcessEnv = process.env): Domain {
  const pinned = readEnvPin(env)
  if (pinned) return pinned
  return classifyPrompt(firstPrompt)
}
