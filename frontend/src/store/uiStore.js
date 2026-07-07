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
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  openSignupModal: () => set({ signupModalOpen: true }),
  closeSignupModal: () => set({ signupModalOpen: false }),
  openFilterModal: () => set({ filterModalOpen: true }),
  closeFilterModal: () => set({ filterModalOpen: false }),
  setHostMode: (value) => {
    try { localStorage.setItem(HOST_MODE_KEY, String(value)) } catch (_) { /* noop */ }
    set({ hostMode: value })
  },
}))
