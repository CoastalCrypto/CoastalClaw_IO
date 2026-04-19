import { useState, useEffect, useCallback, useRef } from 'react'
import { coreClient, type KnowledgeDoc } from '../api/client'

/**
 * KnowledgeLibrary — sidebar panel on the AgentGraph page for managing
 * the shared knowledge corpus. Files dropped here ingest into 'global'
 * scope; files dropped onto an agent node ingest scoped to that agent
 * (the drop handler for that case lives in MyceliumCanvas).
 */

interface Props {
  /** Called when the library wants to flash that an upload succeeded.
   *  The AgentGraph uses this to re-fetch memory summaries so new satellites
   *  appear. Optional — if omitted, no refresh is triggered. */
  onIngestComplete?: (doc: KnowledgeDoc) => void
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const SOURCE_ICON: Record<KnowledgeDoc['sourceType'], string> = {
  pdf:   '◈',
  docx:  '◆',
  text:  '▤',
  image: '◉',
  other: '○',
}

export function KnowledgeLibrary({ onIngestComplete }: Props) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await coreClient.listKnowledge()
      setDocs(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge')
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const ingestFile = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const doc = await coreClient.ingestKnowledge(file, 'global')
      setDocs(prev => [doc, ...prev])
      onIngestComplete?.(doc)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onIngestComplete])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    // One at a time — multi-file uploads share the vision model and would
    // thrash GPU if fired concurrently.
    for (const f of Array.from(files)) await ingestFile(f)
  }, [ingestFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await coreClient.deleteKnowledge(id)
      setDocs(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }, [])

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16, width: 280, maxHeight: 'calc(100vh - 100px)',
      background: 'rgba(13,31,51,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,229,255,0.20)', borderRadius: 12,
      padding: '14px', zIndex: 10,
      fontFamily: 'Space Grotesk, sans-serif',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#00e5ff', letterSpacing: '0.08em',
      }}>
        KNOWLEDGE LIBRARY
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#00e5ff' : 'rgba(0,229,255,0.25)'}`,
          background: dragOver ? 'rgba(0,229,255,0.08)' : 'rgba(0,229,255,0.02)',
          borderRadius: 8, padding: '16px 12px',
          textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontSize: 10, color: '#94adc4', fontFamily: 'JetBrains Mono, monospace',
          lineHeight: 1.6,
        }}
      >
        {uploading ? (
          <span style={{ color: '#f59e0b' }}>Ingesting...</span>
        ) : (
          <>
            Drop PDFs, docs, text, or images<br />
            <span style={{ fontSize: 9, opacity: 0.6 }}>or click to browse · drop on agent to scope</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.docx,.txt,.md,.csv,.json,.xml,.html,.png,.jpg,.jpeg,.gif,.webp"
          onChange={(e) => {
            handleFiles(e.target.files)
            if (inputRef.current) inputRef.current.value = ''
          }}
        />
      </div>

      {error && (
        <div style={{
          fontSize: 10, color: '#ef4444',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 6, padding: '6px 8px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {error}
        </div>
      )}

      <div style={{
        fontSize: 9, fontWeight: 700, color: '#94adc4', letterSpacing: '0.05em',
        marginTop: 4,
      }}>
        {loading ? 'LOADING...' : `${docs.length} DOC${docs.length === 1 ? '' : 'S'}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {docs.map(d => (
          <div
            key={d.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px',
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.10)',
              borderRadius: 6,
            }}
            title={`${d.title} — ${d.chunkCount} chunks · ${d.scope === 'global' ? 'shared' : `scoped to ${d.scope}`}`}
          >
            <span style={{ color: '#00e5ff', fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
              {SOURCE_ICON[d.sourceType]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, color: '#e2f4ff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {d.title}
              </div>
              <div style={{ fontSize: 8, color: '#4a6a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                {prettyBytes(d.sizeBytes)} · {d.chunkCount}ch · {d.scope === 'global' ? 'shared' : 'scoped'}
              </div>
            </div>
            <button
              onClick={() => handleDelete(d.id)}
              title="Remove from knowledge base"
              style={{
                cursor: 'pointer', background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
                borderRadius: 4, padding: '2px 6px', fontSize: 10, lineHeight: 1,
              }}
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
