// Every admin destination must have a case in AdminPage's renderSection switch.
//
// This is a lint rule shaped like a test, and it exists because the failure
// mode is a LIE RATHER THAN AN ERROR. `renderSection` ends in
// `default: return <OverviewSection />`, so an id with no case does not throw,
// does not blank the page, and does not log — the sidebar highlights the tab
// you clicked and the Overview dashboard renders underneath it. It reads as a
// slow page, or as Overview being the right answer.
//
// Two shipped that way and were found by hand on 2026-08-10:
//
//   AdminMonitorSection  the Action Queue's "Review listings" CTA sent
//                        `tab: 'properties'`. The switch has 'admin-properties'
//                        and 'review-listings' and no 'properties', so an admin
//                        acting on "5 properties waiting for approval" was
//                        bounced to the dashboard.
//   UnifiedSidebar       ADMIN_BOTTOM_NAV carried a 'help-center' item that had
//                        never had a section behind it.
//
// A renamed tab re-breaks both silently, which is the whole reason this is
// automated rather than remembered.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')

/** The ids `renderSection` can actually render. */
function switchCases() {
  const body = read('pages/AdminPage.jsx').split('function renderSection()')[1] ?? ''
  return [...body.slice(0, 1500).matchAll(/case\s+'([\w-]+)':/g)].map((m) => m[1])
}

/** `tab: 'x'` in the Action Queue's item list. */
function actionQueueTabs() {
  const src = read('features/admin/components/AdminMonitorSection.jsx')
  return [...src.matchAll(/^\s*tab:\s*'([\w-]+)',/gm)].map((m) => m[1])
}

/** `{ id: 'x', … }` inside a named nav array in the sidebar. */
function sidebarIds(arrayName) {
  const src = read('components/layout/UnifiedSidebar.jsx')
  const block = src.split(`const ${arrayName} = [`)[1]?.split(']')[0] ?? ''
  return [...block.matchAll(/id:\s*'([\w-]+)'/g)].map((m) => m[1])
}

describe('admin tab ids', () => {
  const cases = switchCases()

  it('the switch is parsed, not silently empty', () => {
    // Guards the test itself: a refactor that renames renderSection would make
    // every assertion below pass against an empty list.
    expect(cases.length).toBeGreaterThan(8)
    expect(cases).toContain('overview')
  })

  it('every Action Queue CTA lands on a section that exists', () => {
    const dead = actionQueueTabs().filter((t) => !cases.includes(t))
    expect(dead, `no case in AdminPage's switch — these render Overview instead:\n${dead.join('\n')}`).toEqual([])
  })

  it('every admin sidebar item lands on a section that exists', () => {
    const ids = [...sidebarIds('ADMIN_NAV'), ...sidebarIds('ADMIN_BOTTOM_NAV')]
    expect(ids.length).toBeGreaterThan(8)

    const dead = ids.filter((id) => !cases.includes(id))
    expect(dead, `no case in AdminPage's switch — these render Overview instead:\n${dead.join('\n')}`).toEqual([])
  })
})
