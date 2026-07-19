// How a fact came to exist, made visible.
//
// This is the smallest component in the layer and the one that carries its
// whole argument: a user scanning a card should be able to tell an observation
// from an inference without reading anything. An estimate that looks identical
// to a measurement is how a system starts implying certainty it doesn't have.
//
// Backend contract: backend/src/features/spatial/envelope.js's PROVENANCE.

const CONFIG = {
  MEASURED:  { label: 'Measured',  cls: 'bg-brand-50 text-brand-700',   title: 'Directly observed — a real station, a real reading, a real price.' },
  DERIVED:   { label: 'Calculated', cls: 'bg-slate-100 text-slate-600', title: 'Arithmetic over measured values. No assumptions added.' },
  ESTIMATED: { label: 'Estimated', cls: 'bg-amber-50 text-amber-700',   title: 'A model or rule of thumb stands between the data and this claim.' },
}

export default function ProvenanceChip({ provenance, method }) {
  const cfg = CONFIG[provenance]
  if (!cfg) return null

  return (
    <span
      className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cfg.cls}`}
      // For ESTIMATED the method is the important part — it's what turns
      // "trust us" into something a person can judge for themselves.
      title={method ? `${cfg.title}\n\nHow: ${method}` : cfg.title}
    >
      {cfg.label}
    </span>
  )
}
