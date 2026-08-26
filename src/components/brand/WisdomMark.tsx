import { useBranding } from '../../branding/BrandContext'
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
  const { branding } = useBranding()

  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {branding.logoUrl ? (
        <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200/70">
          <img
            src={branding.logoUrl}
            alt={branding.organizationName || 'Logomarca institucional'}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white shadow-sm ring-1 ring-white/10">
          <span className="text-xs font-black tracking-[-0.08em]">
            IT
          </span>
          <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-sky-400" />
        </div>
      )}

      {!compact && (
        <div className="min-w-0 leading-none">
          <div
            className={cn(
              'truncate text-[15px] font-bold tracking-[-0.02em]',
              darkText ? 'text-slate-950' : 'text-white',
            )}
          >
            {branding.productName}
          </div>
          <div
            className={cn(
              'mt-1 max-w-40 truncate text-[9px] font-semibold uppercase tracking-[0.14em]',
              darkText ? 'text-slate-400' : 'text-slate-500',
            )}
          >
            {branding.organizationName || 'Gestão de tecnologia'}
          </div>
        </div>
      )}
    </div>
  )
}
