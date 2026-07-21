import { formatCurrency } from '@utils/format'
import { PriceRow } from './SheetPrimitives'

// ── Pricing breakdown ────────────────────────────────────────────────────────
// Its own card rather than folded into ActionCard, which the design shows as
// one panel: ActionCard already carries the inline appointment form, and
// stacking ~six more rows on top of that reliably pushes a sticky card past the
// viewport, which is the exact failure the sidebar rules exist to avoid.
export default function PricingCard({ property }) {
  // `rent` holds the refundable lump sum on a LEASE listing (PricingModel in
  // schema.prisma) — labelling it "Monthly rent" misstated a lakh-scale sum.
  const isLease = property.pricingModel === 'LEASE'
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Pricing breakdown</h3>
      <div className="rounded-xl border border-slate-100 px-3.5">
        <PriceRow label={isLease ? 'Lease amount (refundable)' : 'Monthly rent'} value={formatCurrency(Number(property.rent))} accent />
        {!isLease && <PriceRow label="Security deposit" value={property.deposit ? formatCurrency(Number(property.deposit)) : null} />}
        <PriceRow label="Maintenance"        value={property.maintenance ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included'} />
        <PriceRow label="Brokerage"          value={property.brokerage ? formatCurrency(Number(property.brokerage)) : 'None'} />
        <PriceRow label="Electricity (est.)" value={property.electricityCharges ? `${formatCurrency(Number(property.electricityCharges))}/mo` : null} />
        <PriceRow label="Water (est.)"       value={property.waterCharges ? `${formatCurrency(Number(property.waterCharges))}/mo` : null} />
      </div>
    </div>
  )
}
