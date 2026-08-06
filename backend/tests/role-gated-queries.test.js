// A 403 is not an error state, and `enabled: !!user` is not an authorisation
// check.
//
// Why this file exists. On 2026-08-01 a user reported that a brand-new account
// tapping the owner tab got a broken screen. `GET /host/dashboard` is
// `authMiddleware + requireOwner`; a new account is a TENANT, so it 403s — and
// `HostDashboardScreen` ran the query on `enabled: !!user` with no role check,
// so React Query's `isError` rendered an `ErrorState` with a Retry that could
// never succeed. It self-heals on the first listing (the role upgrades to
// OWNER), which is exactly why it survived: **it is invisible to every account
// that has ever listed anything, including all of ours.**
//
// `todo.md`'s bug log states the promotion: sweep every `useQuery` whose
// endpoint carries a role middleware for a missing role gate. This is that
// sweep, run continuously instead of once.
//
// ── The rule, and why it is shaped this way ──────────────────────────────────
//
// A query against an owner-only endpoint can be legitimately guarded in TWO
// places, and only one of them is visible from the query itself:
//
//   1. On the query — `enabled: isOwner && ...`
//   2. At the RENDER site — the component simply never mounts for a non-owner.
//      Web's HostDashboard works this way: DashboardPage only renders it when
//      `hostMode && isOwner`, so its query needs no `enabled` at all.
//
// A test demanding (1) everywhere would fail on correct code, and a test that
// cries wolf gets deleted. So the rule is narrower and always true:
//
//   **If the query gates at all, it must gate on the ROLE.**
//
// An `enabled` that checks sign-in or UI mode LOOKS like authorisation and is
// not — that is the precise shape of the original bug, and of the mobile
// `AppTabs` instance this test found (`enabled: hostMode && !!user`, where a
// tenant can reach host mode by flipping ModeSwitch, which checks no role).
// Having no `enabled` is a claim that the render site guards it; that claim is
// reviewable by a human and is not something this file can check.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const REPO = resolve(import.meta.dirname, '../..')

function walk(dir, exts) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full, exts))
    else if (exts.has(extname(entry))) out.push(full)
  }
  return out
}

const rel = (p) => p.slice(REPO.length + 1).replace(/\\/g, '/')

// ── 1. Which GET endpoints are role-gated, straight from the routers ────────
// Read rather than hardcoded: a new `requireOwner` route is exactly the thing
// this test needs to notice, and a hardcoded list would not.
function roleGatedGetPaths() {
  const index = readFileSync(join(REPO, 'backend/src/index.js'), 'utf8')
  const mounts = new Map() // routes-file basename stem → url prefix
  for (const m of index.matchAll(/app\.use\(\s*'(\/api\/v1\/[^']*)'[^)]*?(\w+)Routes\s*\)/g)) {
    mounts.set(m[2].toLowerCase(), m[1])
  }

  const paths = []
  for (const file of walk(join(REPO, 'backend/src/features'), new Set(['.js']))) {
    if (!file.endsWith('.routes.js')) continue
    const stem = file.split(/[\\/]/).pop().replace('.routes.js', '').toLowerCase()
    const prefix = mounts.get(stem) ?? mounts.get(`${stem}s`) ?? mounts.get(stem.replace(/s$/, ''))
    if (!prefix) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/router\.get\(\s*'([^']*)'([^)]*)\)/g)) {
      if (!/requireOwner|requireBusinessForType/.test(m[2])) continue
      paths.push((prefix + m[1]).replace(/\/$/, ''))
    }
  }
  return paths
}

const GATED = roleGatedGetPaths()

// ── 2. Which client service methods call them ───────────────────────────────
const CLIENT_FILES = [
  ...walk(join(REPO, 'frontend/src'), new Set(['.js', '.jsx'])),
  ...walk(join(REPO, 'mobile/src'), new Set(['.js'])),
].map((p) => ({ path: rel(p), text: readFileSync(p, 'utf8') }))

function gatedServiceMethods() {
  const methods = new Set()
  for (const { path, text } of CLIENT_FILES) {
    if (!/\/services\//.test(path)) continue
    // `dashboard: () => api.get('/host/dashboard'),`
    for (const m of text.matchAll(/(\w+)\s*:\s*\([^)]*\)\s*=>\s*api\.get\(\s*[`'"]([^`'"]+)/g)) {
      const url = m[2].replace(/\/api\/v1/, '')
      if (GATED.some((g) => g.replace('/api/v1', '') === url)) methods.add(m[1])
    }
  }
  return methods
}

const GATED_METHODS = gatedServiceMethods()

// ── 3. Every useQuery that calls one ────────────────────────────────────────
// The object literal passed to useQuery, sliced by brace depth rather than a
// regex — an `enabled` can sit several lines below the queryFn.
function useQueryBlocks(text) {
  const blocks = []
  const re = /useQuery\(\s*\{/g
  let m
  while ((m = re.exec(text))) {
    let depth = 1
    let i = m.index + m[0].length
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
    }
    blocks.push(text.slice(m.index, i))
  }
  return blocks
}

const ROLE_CHECK = /isOwner|role\s*===|['"]OWNER['"]|isBusiness/

function offenders() {
  const out = []
  for (const { path, text } of CLIENT_FILES) {
    if (/\/services\//.test(path)) continue
    for (const block of useQueryBlocks(text)) {
      const usesGated = [...GATED_METHODS].some((fn) => block.includes(`.${fn}(`))
      if (!usesGated) continue
      const enabled = block.match(/enabled\s*:\s*([^,\n]+)/)
      if (!enabled) continue // guarded at the render site — see the header note
      if (ROLE_CHECK.test(enabled[1])) continue
      out.push(`${path} → enabled: ${enabled[1].trim()}`)
    }
  }
  return out
}

describe('queries against role-gated endpoints', () => {
  // Three canaries. Each covers one stage of the scan, because a silent zero at
  // any stage makes the real assertion pass vacuously — a renamed routes file,
  // a service switching off `api.get`, or a move to a different query hook.
  it('finds the role-gated GET endpoints', () => {
    expect(GATED.length).toBeGreaterThan(0)
  })

  it('resolves them to client service methods', () => {
    expect(GATED_METHODS.size).toBeGreaterThan(0)
  })

  it('finds client code calling them', () => {
    const callers = CLIENT_FILES.filter(({ path, text }) =>
      !/\/services\//.test(path) && [...GATED_METHODS].some((fn) => text.includes(`.${fn}(`)))
    expect(callers.length).toBeGreaterThan(0)
  })

  it('gates on the ROLE wherever it gates at all', () => {
    expect(offenders(), [
      'A query against an owner-only endpoint may skip `enabled` entirely (the',
      'render site guards it) — but an `enabled` that checks sign-in or UI mode',
      'LOOKS like authorisation and is not. A tenant reaching it reads a 403 as',
      'a malfunction. Gate on the role: `enabled: isOwner && …`.',
    ].join(' ')).toEqual([])
  })
})
