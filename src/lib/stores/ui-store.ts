// UI 스토어
import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  modalOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setModalOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  modalOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setModalOpen: (open) => set({ modalOpen: open }),
}))
