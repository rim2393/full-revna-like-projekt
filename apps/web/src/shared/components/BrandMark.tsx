import { ShieldCheck } from 'lucide-react'

type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <span className="brand-mark" aria-label="Lumen Guard">
      <span className="brand-mark__sigil" aria-hidden="true">
        <ShieldCheck size={compact ? 18 : 22} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="brand-mark__text">
          <strong>Lumen</strong>
          <span>Guard</span>
        </span>
      )}
    </span>
  )
}
