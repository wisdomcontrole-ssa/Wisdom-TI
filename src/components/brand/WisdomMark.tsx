import { cn } from '../../lib/cn'

interface WisdomMarkProps {
  compact?: boolean
  darkText?: boolean
  className?: string
}

export function WisdomMark({
  compact = false,
  darkText = false,
  className,
}: WisdomMarkProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm">
        <span className="text-sm font-black tracking-[-0.08em]">W</span>
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sky-400" />
      </div>

      {!compact && (
        <div className="leading-none">
          <div
            className={cn(
              'text-[15px] font-bold tracking-[-0.02em]',
              darkText ? 'text-slate-950' : 'text-white',
            )}
          >
            Wisdom
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Tecnologia
          </div>
        </div>
      )}
    </div>
  )
}