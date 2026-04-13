import { useState, useEffect } from 'react'

function adminHeaders(): Record<string, string> {
  const session = sessionStorage.getItem('cc_admin_session') ?? ''
  return session ? { 'x-admin-session': session } : {}
}

interface ConsentState {
  mem0Available: boolean
  consentGranted: boolean
  consentGrantedAt: number | null
}

export function CloudConsent() {
  const [state, setState] = useState<ConsentState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    fetch('/api/admin/cloud-consent', { headers: adminHeaders() })
      .then(r => r.json())
      .then(setState)
      .catch(() => {})
  }, [])

  if (!state || !state.mem0Available) return null

  const toggle = async (grant: boolean) => {
    if (grant && !confirm) { setConfirm(true); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cloud-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ granted: grant }),
      })
      const data = await res.json()
      setState(s => s ? { ...s, consentGranted: grant } : s)
      setConfirm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(13,31,51,0.8)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#e2f4ff', fontWeight: 600, fontSize: 14, margin: 0 }}>
            ☁ Mem0 Cloud Memory
          </p>
          <p style={{ color: '#94adc4', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
            Sends conversation summaries to Mem0's cloud for long-term semantic memory.
            {state.consentGranted && state.consentGrantedAt && (
              <> Enabled {new Date(state.consentGrantedAt).toLocaleDateString()}. Restart required.</>
            )}
          </p>
        </div>
        <button
          onClick={() => toggle(!state.consentGranted)}
          disabled={saving}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
            cursor: saving ? 'not-allowed' : 'pointer',
            background: state.consentGranted ? 'rgba(255,82,82,0.12)' : 'rgba(0,229,255,0.12)',
            border: `1px solid ${state.consentGranted ? 'rgba(255,82,82,0.3)' : 'rgba(0,229,255,0.3)'}`,
            color: state.consentGranted ? '#ff6b6b' : '#00e5ff',
          }}
        >
          {saving ? '...' : state.consentGranted ? 'Revoke' : 'Enable'}
        </button>
      </div>
      {confirm && !state.consentGranted && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.25)', borderRadius: 6 }}>
          <p style={{ color: '#ffb300', fontSize: 12, margin: '0 0 8px' }}>
            ⚠ This will send your conversation data to Mem0's external cloud service. Your data will leave this device. Are you sure?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => toggle(true)} style={{ padding: '3px 10px', background: '#ffb300', color: '#050a0f', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
              Yes, enable cloud memory
            </button>
            <button onClick={() => setConfirm(false)} style={{ padding: '3px 10px', background: 'transparent', color: '#94adc4', border: '1px solid rgba(148,173,196,0.3)', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
