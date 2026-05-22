const LEVEL_CONFIG = {
  HIGH:       { label: 'Under Investigation', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    icon: '!' },
  SUSPICIOUS: { label: 'Suspicious Listing',  bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-900',    icon: '!' },
  MEDIUM:     { label: 'Under Review',        bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'i' },
}

export default function RiskAlert({ riskScore }) {
  if (!riskScore || riskScore.level === 'LOW') return null
  const cfg = LEVEL_CONFIG[riskScore.level]
  if (!cfg) return null
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${cfg.bg} ${cfg.border}`}>
      <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
        {cfg.icon}
      </span>
      <div>
        <p className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</p>
        <p className={`text-xs mt-0.5 ${cfg.text} opacity-80`}>
          {riskScore.level === 'MEDIUM'
            ? 'This property is currently being reviewed by our trust and safety team.'
            : 'This listing has been flagged for suspicious activity. Proceed with caution.'}
        </p>
      </div>
    </div>
  )
}
