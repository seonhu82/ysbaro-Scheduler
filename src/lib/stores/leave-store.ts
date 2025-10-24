// 연차/오프 스토어
import { create } from 'zustand'

interface LeaveStore {
  applications: any[]
  setApplications: (apps: any[]) => void
  addApplication: (app: any) => void
}

export const useLeaveStore = create<LeaveStore>((set) => ({
  applications: [],
  setApplications: (apps) => set({ applications: apps }),
  addApplication: (app) => set((state) => ({
    applications: [...state.applications, app]
  })),
}))
