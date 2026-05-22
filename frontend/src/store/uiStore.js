// UI state: sidebar, modals, loading flags
import { create } from 'zustand'

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  sidebarView: 'list', // 'list' | 'detail'
  loginModalOpen: false,
  signupModalOpen: false,

  openSidebar: (view = 'list') => set({ sidebarOpen: true, sidebarView: view }),
  closeSidebar: () => set({ sidebarOpen: false }),
  openLoginModal: () => set({ loginModalOpen: true }),
  closeLoginModal: () => set({ loginModalOpen: false }),
  openSignupModal: () => set({ signupModalOpen: true }),
  closeSignupModal: () => set({ signupModalOpen: false }),
}))
