import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  MessageCircle,
  FileDown,
  X,
  Send,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './DropdownMenu'
import { Button } from './Button'
import { Spinner } from './Spinner'
import { cn } from '../../lib/cn'
import * as api from '../../services/api'

// Simple chat popup for topic-specific assistant
function AssistantPopup({ isOpen, onClose, topicTitle }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await api.askTopicAssistant(topicTitle, userMessage, messages)
      setMessages((prev) => [...prev, { role: 'assistant', content: response.answer }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="font-semibold text-white">Topic Assistant</h3>
            <p className="text-xs text-white/50">Ask questions about {topicTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <MessageCircle size={32} className="mx-auto text-white/20 mb-2" />
                <p className="text-sm text-white/40">
                  Ask me anything about <span className="text-white/60">{topicTitle}</span>
                </p>
                <p className="text-xs text-white/30 mt-1">I'm here to help clarify your doubts</p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-indigo-500/20 text-white'
                    : 'bg-white/5 text-white/80'
                )}
              >
                {msg.content}
              </div>
            ))
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Spinner /> Thinking...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              disabled={loading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="rounded-xl bg-indigo-500 px-4 py-2.5 text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FloatingActionButton({
  topicId,
  topicTitle,
  onStartNextModule,
  onExportSummary,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const navigate = useNavigate()

  const handleStartNext = () => {
    if (onStartNextModule) {
      onStartNextModule()
    } else {
      navigate(`/learn/${topicId}`)
    }
  }

  return (
    <>
      <div className={cn('fixed bottom-6 right-6 z-50', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <button
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200',
                'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
                'hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/25',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900',
                isOpen && 'rotate-45'
              )}
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X size={24} /> : <Plus size={24} />}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={handleStartNext}>
              <Play size={16} className="text-emerald-400" />
              <span>Start Next Module</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => setAssistantOpen(true)}>
              <MessageCircle size={16} className="text-indigo-400" />
              <span>Ask Assistant</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={onExportSummary}>
              <FileDown size={16} className="text-white/60" />
              <span>Export Summary</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AssistantPopup
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        topicTitle={topicTitle || 'this topic'}
      />
    </>
  )
}

export default FloatingActionButton
