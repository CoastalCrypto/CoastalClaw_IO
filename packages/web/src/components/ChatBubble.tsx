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
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-cyan-500 text-black'
            : 'bg-gray-800 text-gray-100 border border-gray-700'
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-cyan-300">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold mb-1 text-cyan-400">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-cyan-500">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-gray-200">{children}</li>,
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock ? (
                  <code className="block bg-black/60 border border-gray-700 rounded-lg p-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre my-2">
                    {children}
                  </code>
                ) : (
                  <code className="bg-black/40 text-green-300 px-1.5 py-0.5 rounded font-mono text-xs">{children}</code>
                )
              },
              pre: ({ children }) => <>{children}</>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-cyan-600 pl-3 italic text-gray-400 my-2">{children}</blockquote>
              ),
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
              hr: () => <hr className="border-gray-700 my-3" />,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">
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
