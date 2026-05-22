import { useState } from 'react'
import {
  Button, Input, Select, Textarea, Modal, Badge,
  Avatar, Card, Toggle, Tooltip, IconButton, Divider, Spinner,
} from '@components/common'

const BRAND_COLORS = [
  { name: '50',  hex: '#fff3ef' },
  { name: '100', hex: '#ffe4d8' },
  { name: '200', hex: '#ffc9b1' },
  { name: '300', hex: '#ffa480' },
  { name: '400', hex: '#fd8a5a' },
  { name: '500', hex: '#f97142' },
  { name: '600', hex: '#f4511e' },
  { name: '700', hex: '#d94318' },
  { name: '800', hex: '#b33714' },
  { name: '900', hex: '#7d1f08' },
]

const SLATE_COLORS = [
  { name: '50',  hex: '#f8fafc' },
  { name: '100', hex: '#f1f5f9' },
  { name: '200', hex: '#e2e8f0' },
  { name: '300', hex: '#cbd5e1' },
  { name: '400', hex: '#94a3b8' },
  { name: '500', hex: '#64748b' },
  { name: '600', hex: '#475569' },
  { name: '700', hex: '#334155' },
  { name: '800', hex: '#1e293b' },
  { name: '900', hex: '#0f172a' },
]

const SEMANTIC_COLORS = [
  { name: 'Error',   hex: '#dc2626' },
  { name: 'Success', hex: '#16a34a' },
  { name: 'Warning', hex: '#d97706' },
]

function Section({ title, children }) {
  return (
    <section className="mb-12">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ColorRow({ label, colors }) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-slate-600 mb-2">{label}</p>
      <div className="flex gap-1">
        {colors.map((c) => (
          <div key={c.name} className="flex flex-col items-center gap-1">
            <div
              className="w-12 h-12 rounded-lg border border-slate-200"
              style={{ backgroundColor: c.hex }}
              title={`${c.name}: ${c.hex}`}
            />
            <span className="text-[10px] text-slate-400">{c.name}</span>
            <span className="text-[9px] text-slate-300 font-mono">{c.hex}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DesignSystemPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [toggleOn, setToggleOn] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 overflow-auto">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display text-2xl font-bold text-slate-800">
            StayOnMap Design System
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Web components, tokens, and patterns — v1.0
          </p>
        </div>

        {/* Colors */}
        <Section title="Colors">
          <ColorRow label="Brand" colors={BRAND_COLORS} />
          <ColorRow label="Neutral (Slate)" colors={SLATE_COLORS} />
          <ColorRow label="Semantic" colors={SEMANTIC_COLORS} />
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-3 bg-white rounded-xl border border-slate-200 p-6">
            <p className="font-display text-2xl font-bold text-slate-800">
              Display — Sora Bold (logo, heroes, prices)
            </p>
            <p className="text-xl font-semibold text-slate-800">
              Page Heading — Inter Semibold 20px
            </p>
            <p className="text-lg font-semibold text-slate-800">
              Section Heading — Inter Semibold 18px
            </p>
            <p className="text-base font-medium text-slate-800">
              Card Title — Inter Medium 16px
            </p>
            <p className="text-sm text-slate-600">
              Body — Inter Regular 14px
            </p>
            <p className="text-sm font-medium text-slate-700">
              Label — Inter Medium 14px
            </p>
            <p className="text-xs text-slate-400">
              Caption — Inter Regular 12px
            </p>
            <p className="font-display font-semibold text-brand-700">
              ₹28,000/mo — Price badge (Sora)
            </p>
          </div>
        </Section>

        {/* Shadows */}
        <Section title="Elevation / Shadows">
          <div className="flex flex-wrap gap-6">
            {['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-float'].map((s) => (
              <div key={s} className={`w-28 h-20 rounded-xl bg-white flex items-center justify-center ${s}`}>
                <span className="text-xs text-slate-500">{s.replace('shadow-', '')}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Button">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg">Primary LG</Button>
            <Button variant="primary">Primary MD</Button>
            <Button variant="primary" size="sm">Primary SM</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Form Controls">
          <div className="grid grid-cols-2 gap-6 bg-white rounded-xl border border-slate-200 p-6">
            <Input label="Full Name" placeholder="John Doe" />
            <Input label="Monthly Rent" prefix="₹" suffix="/mo" placeholder="28000" />
            <Input label="Email" placeholder="you@email.com" error="Invalid email address" />
            <Select
              label="BHK Type"
              placeholder="Select BHK"
              options={[
                { value: '1', label: '1 BHK' },
                { value: '2', label: '2 BHK' },
                { value: '3', label: '3 BHK' },
              ]}
            />
            <Textarea label="Description" placeholder="Describe the property..." />
            <div className="flex flex-col gap-4 justify-center">
              <Toggle checked={toggleOn} onChange={setToggleOn} label="Furnished" />
              <Toggle checked disabled label="Disabled toggle" />
            </div>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="info">2 BHK</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="warning">Pending</Badge>
          </div>
        </Section>

        {/* Avatar */}
        <Section title="Avatar">
          <div className="flex items-center gap-4">
            <Avatar name="John Doe" size="sm" />
            <Avatar name="Jane Smith" size="md" />
            <Avatar name="Ravi Kumar" size="lg" />
            <Avatar src="https://i.pravatar.cc/100?u=staynear" name="Photo User" size="lg" />
          </div>
        </Section>

        {/* Card */}
        <Section title="Card">
          <div className="grid grid-cols-3 gap-4">
            <Card padding="md" shadow="sm">
              <p className="text-sm font-medium text-slate-800">Default card</p>
              <p className="text-xs text-slate-400 mt-1">shadow-sm, p-4</p>
            </Card>
            <Card padding="lg" shadow="md" hoverable>
              <p className="text-sm font-medium text-slate-800">Hoverable card</p>
              <p className="text-xs text-slate-400 mt-1">Hover me for shadow-md</p>
            </Card>
            <Card padding="none" shadow="sm">
              <div className="h-24 bg-brand-100 rounded-t-xl" />
              <div className="p-4">
                <p className="text-sm font-medium text-slate-800">Image card</p>
                <p className="text-xs text-slate-400 mt-1">padding: none + inner p-4</p>
              </div>
            </Card>
          </div>
        </Section>

        {/* Tooltip */}
        <Section title="Tooltip">
          <div className="flex items-center gap-8">
            <Tooltip text="Top tooltip" position="top">
              <Badge variant="info">Hover (top)</Badge>
            </Tooltip>
            <Tooltip text="Bottom tooltip" position="bottom">
              <Badge variant="info">Hover (bottom)</Badge>
            </Tooltip>
            <Tooltip text="Right tooltip" position="right">
              <Badge variant="info">Hover (right)</Badge>
            </Tooltip>
          </div>
        </Section>

        {/* IconButton */}
        <Section title="IconButton">
          <div className="flex items-center gap-3">
            <IconButton
              icon={<span>✕</span>}
              label="Close"
              variant="ghost"
              size="sm"
            />
            <IconButton
              icon={<span>♡</span>}
              label="Save"
              variant="outline"
              size="md"
            />
            <IconButton
              icon={<span>⚙</span>}
              label="Settings"
              variant="ghost"
              size="lg"
            />
          </div>
        </Section>

        {/* Divider */}
        <Section title="Divider">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <p className="text-sm text-slate-600">Content above</p>
            <Divider />
            <p className="text-sm text-slate-600">Content between</p>
            <Divider label="or" />
            <p className="text-sm text-slate-600">Content below</p>
          </div>
        </Section>

        {/* Spinner */}
        <Section title="Spinner">
          <div className="flex items-center gap-6">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
        </Section>

        {/* Modal */}
        <Section title="Modal">
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
          >
            <p className="text-sm text-slate-600 mb-4">
              This is a modal dialog. Click the backdrop or close button to dismiss.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </div>
          </Modal>
        </Section>

        {/* Floating panel example */}
        <Section title="Floating Panel">
          <div className="bg-slate-200 rounded-xl p-8 relative">
            <p className="text-xs text-slate-400 mb-4">↓ How UI panels look over the map</p>
            <div className="floating-panel px-4 py-3 inline-flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Search Koramangala...</span>
              <Button size="sm">Search</Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
