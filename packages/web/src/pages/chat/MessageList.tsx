import React, { useRef, useEffect } from 'react'
import { ChatBubble } from '../../components/ChatBubble'
import { ApprovalCard } from '../../components/ApprovalCard'
import { TeamResult } from './TeamResult'
import type { Message } from './types'

export interface MessageListProps {
  messages: Message[]
  loading: boolean
  suggestions: string[]
  copiedIdx: number | null
  fileNotice: string
  onCopy: (content: string, idx: number) => void
  onSuggestion: (sug: string) => void
  onResolveApproval: (approvalId: string) => void
}

export const MessageList = React.memo(function MessageList({
  messages, loading, suggestions, copiedIdx, fileNotice,
  onCopy, onSuggestion, onResolveApproval,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      {fileNotice && (
        <div className="mb-3 text-xs text-cyan-400 font-mono px-2 animate-pulse">{fileNotice}</div>
      )}

      {messages.map((m, i) => {
        if (m.role === 'approval') {
          return m.resolved ? null : (
            <ApprovalCard
              key={i}
              approvalId={m.approvalId!}
              agentName={m.agentName!}
              toolName={m.toolName!}
              cmd={m.cmd!}
              agentId={m.agentId ?? 'general'}
              onResolved={() => onResolveApproval(m.approvalId!)}
            />
          )
        }
        if (m.role === 'team') return <TeamResult key={i} msg={m} />
        return (
          <div key={i} className="relative group">
            {m.imageUrl && (
              <div className="flex justify-end mb-1 pr-3">
                <img src={m.imageUrl} alt="attached" className="max-h-48 max-w-xs rounded-lg border border-white/10 object-contain" />
              </div>
            )}
            <ChatBubble role={m.role as 'user' | 'assistant'} content={m.content} />
            {m.role === 'assistant' && (
              <button
                onClick={() => onCopy(m.content, i)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-gray-300 px-2 py-0.5 bg-gray-900/80 rounded"
              >
                {copiedIdx === i ? 'copied!' : 'copy'}
              </button>
            )}
          </div>
        )
      })}

      {loading && (
        <div className="flex justify-start mb-3 px-3">
          <span className="text-xs font-mono text-cyan-500/60 animate-pulse tracking-widest">thinking...</span>
        </div>
      )}

      {suggestions.length > 0 && !loading && (
        <div className="flex justify-start gap-3 mt-4 flex-wrap">
          <span className="text-xs text-amber-500 font-mono self-center tracking-widest animate-pulse">[INSIGHT]</span>
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(sug)}
              className="text-xs border border-amber-500/30 bg-amber-950/20 text-amber-200/80 px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-500 hover:text-amber-100 transition-all"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
})
