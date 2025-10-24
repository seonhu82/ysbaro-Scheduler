// 설정 스토어
import { create } from 'zustand'

interface SettingsStore {
  theme: 'light' | 'dark'
  language: string
  setTheme: (theme: 'light' | 'dark') => void
  setLanguage: (lang: string) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  theme: 'light',
  language: 'ko',
  setTheme: (theme) => set({ theme }),
  setLanguage: (lang) => set({ language: lang }),
}))
