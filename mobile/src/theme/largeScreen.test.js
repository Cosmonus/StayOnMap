/**
 * Every screen has to have DECIDED what it does with a wide window.
 *
 * `breakpoints.test.js` pins what the decision means; this pins that the
 * decision was made at all, which is the half that rots. Nobody on the team
 * develops on a tablet, so a screen added next month will be built and reviewed
 * at 393dp, look correct, and stretch its form across 1280dp on the one device
 * class this whole file exists for — silently, because there is nothing to see
 * on the device the author is holding.
 *
 * So the rule is not "every screen must cap". It is "every screen must say".
 * A screen either reads the layout (`useLayout` / `useCardGrid`) or appears in
 * EXEMPT below with a reason. Both are fine answers; not answering is not.
 */
import { join } from 'node:path'
import { readSource } from '../test/sourceScan'

// Comments are stripped by readSource, and that is load-bearing here — see the
// bug recorded in that file.
const files = readSource(join(__dirname, '..'))
const screens = files.filter((f) => f.path.endsWith('Screen.js'))

// Screens that legitimately never ask. Each is here for one of exactly two
// reasons, and a new entry should be able to state which:
//
//   1. it renders no layout of its own — it is a three-line wrapper around a
//      component that has already decided; or
//   2. it is genuinely full-bleed, and capping it would be the bug.
const EXEMPT = {
  // (1) Wrappers. The decision lives one file down.
  'features/chat/screens/ConversationListScreen.js': 'picks TenantMessages or OwnerInbox, renders neither',
  'features/chat/screens/TenantMessagesScreen.js': 'ThreadListScreen with renter words',
  'features/chat/screens/OwnerInboxScreen.js': 'ThreadListScreen with host words',
  'features/listings/screens/AddListingScreen.js': 'hosts OnboardingWizard, which caps',
  // (2) Full-bleed. A map is not prose and has no readable measure — the whole
  // point of a bigger window here is MORE MAP.
  'features/discover/screens/ExploreScreen.js': 'the map is the screen',
}

describe('large-screen coverage', () => {
  it('found the screens', () => {
    // Without this, a rename of the *Screen.js convention would make every
    // assertion below pass over an empty list.
    expect(screens.length).toBeGreaterThan(25)
  })

  it('has every screen either reading the layout or exempt with a reason', () => {
    const undecided = screens
      .filter((s) => !/useLayout|useCardGrid/.test(s.src))
      .map((s) => s.path)
      .filter((p) => !EXEMPT[p])
    // The array IS the message — jest prints it, naming the screen to fix.
    expect(undecided).toEqual([])
  })

  it('keeps the exemption list honest', () => {
    // An exemption for a file that no longer exists, or one that has since
    // started reading the layout, is a stale claim. Both mean somebody should
    // look, so both fail rather than being quietly ignored.
    const stale = Object.keys(EXEMPT).filter((p) => {
      const screen = screens.find((s) => s.path === p)
      return !screen || /useLayout|useCardGrid/.test(screen.src)
    })
    expect(stale).toEqual([])
  })

  it('reads the window through the hook, never Dimensions.get', () => {
    // `Dimensions.get('window')` at module scope answers once, at import, and
    // is then wrong for the rest of the process — which is exactly the case
    // this file is about, because a tablet on Android 16 can be rotated or
    // dragged into a multi-window pane mid-session. PropertyDetailScreen sized
    // its photo gallery that way and its paging stopped landing on a photo.
    const offenders = files
      .filter((f) => /Dimensions\.get\s*\(/.test(f.src))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })
})
