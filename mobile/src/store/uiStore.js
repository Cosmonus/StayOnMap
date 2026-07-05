// Host-mode toggle — mirrors frontend/src/store/uiStore.js's hostMode/
// setHostMode fields, persisted via AsyncStorage instead of localStorage.
// AsyncStorage is async, so this store can't hydrate synchronously at
// creation time like the web version does — AuthContext.js reads the
// persisted value in its mount effect (alongside the auth token) and calls
// _setHostModeSilent() before `loading` flips false, so AppTabs never
// mounts with a stale hostMode.
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const HOST_MODE_KEY = 'host_mode'

export const useUiStore = create((set) => ({
  hostMode: false,
  setHostMode: (value) => {
    AsyncStorage.setItem(HOST_MODE_KEY, String(value)).catch(() => {})
    set({ hostMode: value })
  },
  _setHostModeSilent: (value) => set({ hostMode: value }),

  // Transient (not persisted) — lets ProfileScreen's "Become a host"/"Manage
  // listings" row request landing directly on the My Listing tab instead of
  // Dashboard. AppTabs reads this once as initialRouteName then resets it.
  hostEntryTab: 'Dashboard',
  setHostEntryTab: (tab) => set({ hostEntryTab: tab }),
}))
