import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        style={{
          maxWidth: '75%',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          lineHeight: '1.625',
          ...(isUser
            ? {
                background: 'rgba(0,229,255,0.10)',
                border: '1px solid rgba(0,229,255,0.20)',
                borderRadius: '12px 12px 4px 12px',
                color: '#e2f4ff',
              }
            : {
                background: '#112240',
                border: '1px solid #1a3a5c',
                borderRadius: '12px 12px 12px 4px',
                color: '#e2f4ff',
              }),
        }}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              h1: ({ children }) => <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#00e5ff' }}>{children}</h1>,
              h2: ({ children }) => <h2 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#00e5ff' }}>{children}</h2>,
              h3: ({ children }) => <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem', color: '#00e5ff' }}>{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-gray-200">{children}</li>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock ? (
                  <code style={{ display: 'block', background: 'rgba(0,0,0,0.60)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#10b981', overflowX: 'auto', whiteSpace: 'pre', margin: '0.5rem 0' }}>
                    {children}
                  </code>
                ) : (
                  <code style={{ background: 'rgba(0,0,0,0.40)', color: '#10b981', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{children}</code>
                )
              },
              pre: ({ children }) => <>{children}</>,
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: '2px solid rgba(0,229,255,0.35)', paddingLeft: '0.75rem', fontStyle: 'italic', color: '#94a3b8', margin: '0.5rem 0' }}>{children}</blockquote>
              ),
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
              hr: () => <hr className="border-gray-700 my-3" />,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#00e5ff', textDecoration: 'underline' }}>
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                  <table className="text-xs border-collapse border border-gray-700 w-full">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-gray-700 px-2 py-1 bg-gray-900 text-left font-semibold">{children}</th>,
              td: ({ children }) => <td className="border border-gray-700 px-2 py-1">{children}</td>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
