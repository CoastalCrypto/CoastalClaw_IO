import React, { useState } from 'react'
import { ChatBubble } from '../../components/ChatBubble'
import type { Message } from './types'

export const TeamResult = React.memo(function TeamResult({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] bg-gray-800 border border-cyan-900/60 rounded-2xl px-4 py-3 text-sm">
        <div className="flex items-center gap-2 mb-2 text-xs text-cyan-500 font-mono">
          <span className="animate-none">TEAM</span>
          <span className="text-gray-600">·</span>
          <span>{msg.subtaskCount} subtasks</span>
          {(msg.subtaskCount ?? 0) > 0 && (
            <button onClick={() => setOpen(o => !o)} className="ml-auto text-gray-600 hover:text-gray-400">
              {open ? 'hide' : 'show subtasks'}
            </button>
          )}
        </div>
        <ChatBubble role="assistant" content={msg.content} />
        {open && msg.subtasks && (
          <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
            {msg.subtasks.map((s) => (
              <div key={s.subtaskId} className="text-xs bg-gray-900 rounded p-2">
                <div className="text-gray-500 font-mono mb-1">{s.subtaskId}</div>
                <div className="text-gray-300">{s.reply}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
