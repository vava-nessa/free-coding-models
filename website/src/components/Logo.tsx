/**
 * @file src/components/Logo.tsx
 * @description Shared icon.png-derived brand mark and wordmark for free-coding-models.
 */

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/android-chrome-192x192.png"
      alt=""
      width={size}
      height={size}
      className={`rounded-[22%] object-cover border-[2px] border-accent ${className}`}
      aria-hidden="true"
    />
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={28} />
      <span className="font-mono text-sm font-semibold tracking-tight text-fg">
        free-coding-models
      </span>
      <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-accent-fg border border-accent/30 shadow-sm">
        v0.6.2
      </span>
    </div>
  )
}
