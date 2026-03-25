import { useState } from 'react'
import type { ModelGroup, RegistryUpdate } from '../api/client'

type Domain = 'coo' | 'cfo' | 'cto' | 'general'
type Urgency = 'high' | 'medium' | 'low'

const DOMAINS: { key: Domain; label: string }[] = [
  { key: 'coo', label: 'COO' },
  { key: 'cfo', label: 'CFO' },
  { key: 'cto', label: 'CTO' },
  { key: 'general', label: 'General' },
]

const URGENCIES: { key: Urgency; label: string }[] = [
  { key: 'high',   label: 'High Priority' },
  { key: 'medium', label: 'Medium' },
  { key: 'low',    label: 'Low' },
]

interface DomainAssignerProps {
  models: ModelGroup[]
  registry: Record<string, Record<string, string>>
  onChange: (update: RegistryUpdate) => void
}

type CellKey = `${Domain}.${Urgency}`
type CellState = 'idle' | 'success' | 'error'

export function DomainAssigner({ models, registry, onChange }: DomainAssignerProps) {
  const allVariants = models.flatMap(g => g.variants)
  const [cellStates, setCellStates] = useState<Partial<Record<CellKey, CellState>>>({})

  const handleChange = async (domain: Domain, urgency: Urgency, value: string) => {
    const key: CellKey = `${domain}.${urgency}`
    try {
      await onChange({
        [domain]: { ...registry[domain], [urgency]: value },
      } as RegistryUpdate)
      setCellStates(s => ({ ...s, [key]: 'success' }))
    } catch {
      setCellStates(s => ({ ...s, [key]: 'error' }))
    }
    setTimeout(() => setCellStates(s => ({ ...s, [key]: 'idle' })), 1500)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Domain Assignments</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-500 pb-3 pr-4">Domain</th>
              {URGENCIES.map(u => (
                <th key={u.key} className="text-left text-xs text-gray-500 pb-3 pr-4">{u.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map(domain => (
              <tr key={domain.key} className="border-t border-gray-800">
                <td className="py-3 pr-4 font-semibold text-white">{domain.label}</td>
                {URGENCIES.map(urgency => {
                  const current = registry[domain.key]?.[urgency.key] ?? ''
                  const state = cellStates[`${domain.key}.${urgency.key}` as CellKey] ?? 'idle'
                  const borderClass = state === 'success'
                    ? 'border-green-500'
                    : state === 'error'
                    ? 'border-red-500'
                    : 'border-gray-700'
                  return (
                    <td key={urgency.key} className="py-3 pr-4">
                      <select
                        value={current}
                        onChange={(e) => handleChange(domain.key, urgency.key, e.target.value)}
                        title={state === 'error' ? 'Update failed \u2014 check model registry' : undefined}
                        aria-label={`${domain.label} ${urgency.label}`}
                        className={`bg-gray-800 border ${borderClass} text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500 w-full transition-colors`}
                      >
                        <option value="">\u2014 select \u2014</option>
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
