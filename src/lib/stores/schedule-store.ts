// 스케줄 상태 (Zustand)

import { create } from 'zustand'

export interface DailySchedule {
  id: string
  date: Date
  dayOfWeek: number
  doctors: string[] // Doctor IDs
  staff: string[] // Staff IDs
  requiredStaff: number
  hasNightShift: boolean
  isHoliday: boolean
  note?: string
}

export interface WeeklySchedule {
  id: string
  startDate: Date
  endDate: Date
  year: number
  weekNumber: number
  isConfirmed: boolean
  dailySchedules: DailySchedule[]
}

export interface ScheduleFilter {
  year: number
  month: number
  weekNumber?: number
  doctorId?: string
  staffId?: string
  showOnlyUnassigned?: boolean
}

interface ScheduleStore {
  // Current state
  currentWeek: WeeklySchedule | null
  selectedDate: Date | null
  selectedSchedule: DailySchedule | null
  filter: ScheduleFilter

  // Loading states
  isLoading: boolean
  isSaving: boolean

  // Validation
  validationErrors: string[]
  validationWarnings: string[]

  // Actions
  setCurrentWeek: (week: WeeklySchedule | null) => void
  setSelectedDate: (date: Date | null) => void
  setSelectedSchedule: (schedule: DailySchedule | null) => void
  setFilter: (filter: Partial<ScheduleFilter>) => void

  setLoading: (loading: boolean) => void
  setSaving: (saving: boolean) => void

  setValidationErrors: (errors: string[]) => void
  setValidationWarnings: (warnings: string[]) => void
  clearValidation: () => void

  // Schedule operations
  updateDailySchedule: (scheduleId: string, updates: Partial<DailySchedule>) => void
  addDoctorToSchedule: (scheduleId: string, doctorId: string) => void
  removeDoctorFromSchedule: (scheduleId: string, doctorId: string) => void
  addStaffToSchedule: (scheduleId: string, staffId: string) => void
  removeStaffFromSchedule: (scheduleId: string, staffId: string) => void

  // Utility
  getDailyScheduleByDate: (date: Date) => DailySchedule | undefined
  getUnassignedSchedules: () => DailySchedule[]
  reset: () => void
}

const initialFilter: ScheduleFilter = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1
}

export const useScheduleStore = create<ScheduleStore>((set, get) => ({
  // Initial state
  currentWeek: null,
  selectedDate: null,
  selectedSchedule: null,
  filter: initialFilter,
  isLoading: false,
  isSaving: false,
  validationErrors: [],
  validationWarnings: [],

  // Basic setters
  setCurrentWeek: (week) => set({ currentWeek: week }),

  setSelectedDate: (date) => {
    set({ selectedDate: date })
    if (date) {
      const schedule = get().getDailyScheduleByDate(date)
      set({ selectedSchedule: schedule })
    }
  },

  setSelectedSchedule: (schedule) => set({ selectedSchedule: schedule }),

  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),

  setLoading: (loading) => set({ isLoading: loading }),
  setSaving: (saving) => set({ isSaving: saving }),

  setValidationErrors: (errors) => set({ validationErrors: errors }),
  setValidationWarnings: (warnings) => set({ validationWarnings: warnings }),
  clearValidation: () => set({ validationErrors: [], validationWarnings: [] }),

  // Schedule operations
  updateDailySchedule: (scheduleId, updates) =>
    set((state) => {
      if (!state.currentWeek) return state

      const updatedDailySchedules = state.currentWeek.dailySchedules.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, ...updates } : schedule
      )

      return {
        currentWeek: {
          ...state.currentWeek,
          dailySchedules: updatedDailySchedules
        },
        selectedSchedule:
          state.selectedSchedule?.id === scheduleId
            ? { ...state.selectedSchedule, ...updates }
            : state.selectedSchedule
      }
    }),

  addDoctorToSchedule: (scheduleId, doctorId) =>
    set((state) => {
      if (!state.currentWeek) return state

      const updatedDailySchedules = state.currentWeek.dailySchedules.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, doctors: [...schedule.doctors, doctorId] }
          : schedule
      )

      return {
        currentWeek: {
          ...state.currentWeek,
          dailySchedules: updatedDailySchedules
        }
      }
    }),

  removeDoctorFromSchedule: (scheduleId, doctorId) =>
    set((state) => {
      if (!state.currentWeek) return state

      const updatedDailySchedules = state.currentWeek.dailySchedules.map((schedule) =>
        schedule.id === scheduleId
          ? {
              ...schedule,
              doctors: schedule.doctors.filter((id) => id !== doctorId)
            }
          : schedule
      )

      return {
        currentWeek: {
          ...state.currentWeek,
          dailySchedules: updatedDailySchedules
        }
      }
    }),

  addStaffToSchedule: (scheduleId, staffId) =>
    set((state) => {
      if (!state.currentWeek) return state

      const updatedDailySchedules = state.currentWeek.dailySchedules.map((schedule) =>
        schedule.id === scheduleId
          ? { ...schedule, staff: [...schedule.staff, staffId] }
          : schedule
      )

      return {
        currentWeek: {
          ...state.currentWeek,
          dailySchedules: updatedDailySchedules
        }
      }
    }),

  removeStaffFromSchedule: (scheduleId, staffId) =>
    set((state) => {
      if (!state.currentWeek) return state

      const updatedDailySchedules = state.currentWeek.dailySchedules.map((schedule) =>
        schedule.id === scheduleId
          ? {
              ...schedule,
              staff: schedule.staff.filter((id) => id !== staffId)
            }
          : schedule
      )

      return {
        currentWeek: {
          ...state.currentWeek,
          dailySchedules: updatedDailySchedules
        }
      }
    }),

  // Utility functions
  getDailyScheduleByDate: (date) => {
    const state = get()
    if (!state.currentWeek) return undefined

    return state.currentWeek.dailySchedules.find((schedule) => {
      const scheduleDate = new Date(schedule.date)
      scheduleDate.setHours(0, 0, 0, 0)
      const targetDate = new Date(date)
      targetDate.setHours(0, 0, 0, 0)
      return scheduleDate.getTime() === targetDate.getTime()
    })
  },

  getUnassignedSchedules: () => {
    const state = get()
    if (!state.currentWeek) return []

    return state.currentWeek.dailySchedules.filter(
      (schedule) =>
        schedule.doctors.length === 0 ||
        schedule.staff.length < schedule.requiredStaff
    )
  },

  reset: () =>
    set({
      currentWeek: null,
      selectedDate: null,
      selectedSchedule: null,
      filter: initialFilter,
      isLoading: false,
      isSaving: false,
      validationErrors: [],
      validationWarnings: []
    })
}))
