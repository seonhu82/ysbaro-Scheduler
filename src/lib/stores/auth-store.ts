// 인증 스토어
import { create } from 'zustand'

interface AuthStore {
  user: any | null
  setUser: (user: any) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}))
