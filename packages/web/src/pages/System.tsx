import { useState, useEffect, useCallback } from 'react'
import { coreClient, type SystemStats } from '../api/client'
import { NavBar, type NavPage } from '../components/NavBar'

function fmtBytes(b: number): string {
  if (b === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / 1024 ** i).toFixed(1)} ${units[i]}`
}

function Bar({ pct, color = 'bg-cyan-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500 font-mono mb-2">{label}</div>
      {children}
    </div>
  )
}

function fmtUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const LOG_SERVICES = ['coastalclaw-server', 'coastalclaw-daemon', 'coastalclaw-architect', 'ollama']

export function System({ onNav }: { onNav: (page: NavPage) => void }) {
  const [stats, setStats]       = useState<SystemStats | null>(null)
  const [logs, setLogs]         = useState<string[]>([])
  const [logService, setLogService] = useState(LOG_SERVICES[0])
  const [logsLoading, setLogsLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [statsError, setStatsError] = useState('')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [remoteCommit, setRemoteCommit] = useState<string | null>(null)

  const fetchStats = useCallback(() => {
    coreClient.getSystemStats()
      .then(setStats)
      .catch(() => setStatsError('Could not reach server'))
  }, [])

  const fetchLogs = useCallback((service: string) => {
    setLogsLoading(true)
    coreClient.getLogs(service, 150)
      .then(({ lines }) => setLogs(lines))
      .catch(() => setLogs(['(could not fetch logs — admin token required)']))
      .finally(() => setLogsLoading(false))
  }, [])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 5000)
    return () => clearInterval(id)
  }, [fetchStats])

  const checkUpdate = useCallback(() => {
    coreClient.checkForUpdate()
      .then(({ updateAvailable: avail, remoteCommit: rc }) => {
        setUpdateAvailable(avail)
        setRemoteCommit(rc)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    checkUpdate()
    const id = setInterval(checkUpdate, 24 * 60 * 60 * 1000) // recheck daily
    return () => clearInterval(id)
  }, [checkUpdate])

  useEffect(() => { fetchLogs(logService) }, [logService, fetchLogs])

  const handleUpdate = async () => {
    if (!confirm('This will pull the latest code, rebuild, and restart the server. Continue?')) return
    setUpdating(true)
    setUpdateMsg('')
    setUpdateAvailable(false)
    try {
      const { message } = await coreClient.triggerUpdate()
      setUpdateMsg(message)
    } catch (e: any) {
      setUpdateMsg(`Error: ${e.message}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>
      <NavBar page="system" onNav={onNav} />

      <div className="pt-20 px-4 sm:px-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">System</h1>
          <div className="flex items-center gap-3">
            {stats && <span className="text-xs text-gray-500 font-mono">uptime {fmtUptime(stats.uptime)}</span>}
            <button
              onClick={fetchStats}
              className="text-xs text-gray-500 hover:text-cyan-400 font-mono transition-colors"
            >↺ refresh</button>
            <div className="relative">
              <button
                onClick={handleUpdate}
                disabled={updating}
                className={`px-4 py-2 text-sm border rounded-lg font-mono transition-colors disabled:opacity-40 ${
                  updateAvailable
                    ? 'bg-cyan-900/40 hover:bg-cyan-900/60 border-cyan-700 text-cyan-300'
                    : 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                }`}
              >
                {updating ? 'Updating...' : updateAvailable ? 'Update available ↑' : 'Update CoastalClaw'}
              </button>
              {updateAvailable && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
            {updateAvailable && remoteCommit && (
              <span className="text-xs text-cyan-500 font-mono">→ {remoteCommit}</span>
            )}
            <button
              onClick={checkUpdate}
              className="text-xs text-gray-600 hover:text-gray-400 font-mono transition-colors"
              title="Check for updates now"
            >check</button>
          </div>
        </div>

        {updateMsg && (
          <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-800 rounded-lg text-cyan-300 text-sm font-mono">
            {updateMsg}
          </div>
        )}

        {statsError && !stats && (
          <p className="text-red-400 text-sm mb-4">{statsError}</p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {/* CPU */}
            <StatCard label="CPU">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold">{stats.cpu.percent}%</span>
                <span className="text-xs text-gray-500">utilization</span>
              </div>
              <Bar pct={stats.cpu.percent} color={stats.cpu.percent > 80 ? 'bg-red-500' : 'bg-cyan-500'} />
            </StatCard>

            {/* RAM */}
            <StatCard label="MEMORY">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold">{fmtBytes(stats.mem.used)}</span>
                <span className="text-xs text-gray-500">of {fmtBytes(stats.mem.total)}</span>
              </div>
              <Bar
                pct={(stats.mem.used / stats.mem.total) * 100}
                color={(stats.mem.used / stats.mem.total) > 0.85 ? 'bg-red-500' : 'bg-purple-500'}
              />
            </StatCard>

            {/* GPU */}
            {stats.gpu ? (
              <StatCard label={`GPU · ${stats.gpu.name}`}>
                <div className="flex justify-between items-baseline">
                  <span className="text-2xl font-bold">{stats.gpu.utilPercent}%</span>
                  <span className="text-xs text-gray-500">
                    {fmtBytes(stats.gpu.vramUsed)} / {fmtBytes(stats.gpu.vramTotal)} VRAM
                  </span>
                </div>
                <Bar pct={stats.gpu.utilPercent} color="bg-green-500" />
                <Bar pct={(stats.gpu.vramUsed / stats.gpu.vramTotal) * 100} color="bg-yellow-500" />
              </StatCard>
            ) : (
              <StatCard label="GPU">
                <span className="text-gray-500 text-sm">No CUDA GPU detected</span>
              </StatCard>
            )}

            {/* Disk */}
            <StatCard label="DISK">
              {stats.disk.map((d) => (
                <div key={d.path} className="mb-2 last:mb-0">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span className="font-mono">{d.path}</span>
                    <span>{fmtBytes(d.used)} / {fmtBytes(d.total)}</span>
                  </div>
                  <Bar pct={(d.used / d.total) * 100} color={(d.used / d.total) > 0.9 ? 'bg-red-500' : 'bg-orange-500'} />
                </div>
              ))}
            </StatCard>

            {/* Loaded models */}
            {stats.models.length > 0 && (
              <div className="col-span-2">
                <StatCard label="LOADED MODELS">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {stats.models.map((m) => (
                      <span key={m} className="px-2 py-1 bg-cyan-900/40 border border-cyan-800/50 rounded text-xs font-mono text-cyan-300">
                        {m}
                      </span>
                    ))}
                  </div>
                </StatCard>
              </div>
            )}
          </div>
        )}

        {/* Log viewer */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">Logs</h2>
            <div className="flex gap-1">
              {LOG_SERVICES.map((s) => (
                <button
                  key={s}
                  onClick={() => setLogService(s)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                    logService === s
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-700'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }`}
                >
                  {s.replace('coastalclaw-', '')}
                </button>
              ))}
            </div>
            <button
              onClick={() => fetchLogs(logService)}
              className="text-xs text-gray-500 hover:text-cyan-400 font-mono transition-colors ml-auto"
            >↺</button>
          </div>

          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs text-gray-400 space-y-0.5">
            {logsLoading
              ? <span className="text-cyan-500 animate-pulse">Loading...</span>
              : logs.length === 0
                ? <span className="text-gray-600">No log entries found.</span>
                : logs.map((line, i) => (
                    <div key={i} className={`leading-5 ${line.includes('ERROR') || line.includes('error') ? 'text-red-400' : line.includes('WARN') ? 'text-yellow-400' : ''}`}>
                      {line}
                    </div>
                  ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
