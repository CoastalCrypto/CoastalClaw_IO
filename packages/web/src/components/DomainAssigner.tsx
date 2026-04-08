import { useRef, useState } from 'react'
import type { AgentRecord, ModelGroup, RegistryUpdate } from '../api/client'

type Urgency = 'high' | 'medium' | 'low'

const URGENCIES: { key: Urgency; label: string }[] = [
  { key: 'high',   label: 'High' },
  { key: 'medium', label: 'Med' },
  { key: 'low',    label: 'Low' },
]

interface DomainAssignerProps {
  agents: AgentRecord[]
  models: ModelGroup[]
  registry: Record<string, Record<string, string>>
  onChange: (update: RegistryUpdate) => Promise<void>
}

type CellState = 'idle' | 'success' | 'error'

export function DomainAssigner({ agents, models, registry, onChange }: DomainAssignerProps) {
  const allVariants = models.flatMap(g => g.variants)
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleChange = async (agentId: string, urgency: Urgency, value: string) => {
    const key = `${agentId}.${urgency}`
    if (timers.current[key]) clearTimeout(timers.current[key])
    try {
      await onChange({ [agentId]: { ...registry[agentId], [urgency]: value } })
      setCellStates(s => ({ ...s, [key]: 'success' }))
    } catch {
      setCellStates(s => ({ ...s, [key]: 'error' }))
    }
    timers.current[key] = setTimeout(() => {
      setCellStates(s => ({ ...s, [key]: 'idle' }))
      delete timers.current[key]
    }, 1500)
  }

  if (agents.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Domain Assignments</h3>
        <p className="text-gray-500 text-sm">No agents found. Add an agent first.</p>
      </div>
    )
  }

  if (allVariants.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Domain Assignments</h3>
        <p className="text-gray-500 text-sm">Install a model first, then assign it to agents here.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Domain Assignments</h3>
      <p className="text-xs text-gray-500 mb-4">Set which model each agent uses per priority level.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-500 pb-3 pr-4 font-normal">Agent</th>
              {URGENCIES.map(u => (
                <th key={u.key} className="text-left text-xs text-gray-500 pb-3 pr-3 font-normal">{u.label} priority</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent.id} className="border-t border-gray-800">
                <td className="py-3 pr-4">
                  <div className="font-medium text-white text-xs leading-tight">{agent.name}</div>
                  <div className="text-gray-500 text-xs truncate max-w-[130px]" title={agent.role}>{agent.role}</div>
                  {!agent.builtIn && (
                    <span className="text-xs text-cyan-600 font-mono">custom</span>
                  )}
                </td>
                {URGENCIES.map(urgency => {
                  const stateKey = `${agent.id}.${urgency.key}`
                  const current = registry[agent.id]?.[urgency.key] ?? ''
                  const state = cellStates[stateKey] ?? 'idle'
                  const borderClass =
                    state === 'success' ? 'border-green-500' :
                    state === 'error'   ? 'border-red-500'   :
                                          'border-gray-700'
                  return (
                    <td key={urgency.key} className="py-3 pr-3">
                      <select
                        value={current}
                        onChange={e => handleChange(agent.id, urgency.key, e.target.value)}
                        aria-label={`${agent.name} ${urgency.label} priority model`}
                        className={`bg-gray-800 border ${borderClass} text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500 w-full transition-colors`}
                      >
                        <option value="">— none —</option>
                        {allVariants.map(v => (
                          <option key={v.id} value={v.id}>{v.id}</option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
