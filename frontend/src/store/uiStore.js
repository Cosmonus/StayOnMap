// UI state: sidebar, modals, loading flags
import { create } from 'zustand'

const HOST_MODE_KEY = 'stayonmap:host-mode'

function readHostMode() {
  try { return localStorage.getItem(HOST_MODE_KEY) === 'true' } catch { return false }
}

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  sidebarView: 'list', // 'list' | 'detail'
  loginModalOpen: false,
  signupModalOpen: false,
  filterModalOpen: false,
  hostMode: readHostMode(),

  openSidebar: (view = 'list') => set({ sidebarOpen: true, sidebarView: view }),
  closeSidebar: () => set({ sidebarOpen: false }),
  // `intent` is optional: { tab: 'otp', email } opens straight onto the
  // "Email me a sign-in code" form with the address filled in — what the
  // WhatsApp bot's link (/?signin=<email>) needs. Most callers pass the click
  // event (onClick={openLoginModal}), which is why only a real intent counts.
  loginIntent: null,
  openLoginModal: (intent) => set({
    loginModalOpen: true,
    loginIntent: intent && typeof intent.tab === 'string' ? { tab: intent.tab, email: intent.email ?? '' } : null,
  }),
  closeLoginModal: () => set({ loginModalOpen: false, loginIntent: null }),
  openSignupModal: () => set({ signupModalOpen: true }),
  closeSignupModal: () => set({ signupModalOpen: false }),
  openFilterModal: () => set({ filterModalOpen: true }),
  closeFilterModal: () => set({ filterModalOpen: false }),
  setHostMode: (value) => {
    try { localStorage.setItem(HOST_MODE_KEY, String(value)) } catch (_) { /* noop */ }
    set({ hostMode: value })
  },
}))
