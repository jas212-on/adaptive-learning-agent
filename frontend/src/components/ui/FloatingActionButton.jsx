import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Play,
  BarChart3,
  HelpCircle,
  FileDown,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './DropdownMenu'
import { cn } from '../../lib/cn'

export function FloatingActionButton({
  topicId,
  onStartNextModule,
  onViewProgress,
  onGenerateQuiz,
  onExportSummary,
  className,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handleStartNext = () => {
    if (onStartNextModule) {
      onStartNextModule()
    } else {
      navigate(`/learn/${topicId}`)
    }
  }

  return (
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

          <DropdownMenuItem onSelect={onViewProgress}>
            <BarChart3 size={16} className="text-blue-400" />
            <span>View Progress</span>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onGenerateQuiz}>
            <HelpCircle size={16} className="text-amber-400" />
            <span>Generate Quiz</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onExportSummary}>
            <FileDown size={16} className="text-white/60" />
            <span>Export Summary</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default FloatingActionButton
