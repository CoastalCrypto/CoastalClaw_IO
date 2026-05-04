import { useState, useEffect } from 'react'
import { NavBar, type NavPage } from '../components/NavBar'
import { coreClient } from '../api/client'
import { StatusCard } from './architect/StatusCard'
import { TabBar, type Tab } from './architect/TabBar'
import { QueueTab } from './architect/QueueTab'
import { ActivityTab } from './architect/ActivityTab'
import { InsightsTab } from './architect/InsightsTab'
import { ReceiptsTab } from './architect/ReceiptsTab'
import { SettingsTab } from './architect/SettingsTab'
import { FirstRunWizard } from './architect/FirstRunWizard'
import { PauseButton } from './architect/PauseButton'

export function Architect({ onNav }: { onNav: (page: NavPage) => void }) {
  const [tab, setTab] = useState<Tab>('queue')
  const [status, setStatus] = useState<{ power: string; mode: string } | null>(null)
  const [showWizard, setShowWizard] = useState(!localStorage.getItem('architect_setup_done'))

  useEffect(() => {
    coreClient.architectStatus().then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen text-white" style={{ background: '#050a0f' }}>
      <NavBar page={'architect' as NavPage} onNav={onNav} />

      {showWizard && (
        <FirstRunWizard onComplete={() => {
          setShowWizard(false)
          coreClient.architectStatus().then(setStatus).catch(() => {})
        }} />
      )}

      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#e2f4ff' }}>Architect</h1>
            <p className="text-xs mt-1" style={{ color: '#94adc4' }}>Self-healing improvement system</p>
          </div>
          <PauseButton onPaused={() => coreClient.architectStatus().then(setStatus).catch(() => {})} />
        </div>
        <StatusCard status={status} />
        <TabBar tab={tab} setTab={setTab} />
        {tab === 'queue'    && <QueueTab />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'insights' && <InsightsTab />}
        {tab === 'receipts' && <ReceiptsTab />}
        {tab === 'settings' && <SettingsTab onStatusChange={setStatus} />}
      </div>
    </div>
  )
}
