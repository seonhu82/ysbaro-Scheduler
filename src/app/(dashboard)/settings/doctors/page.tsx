'use client'

import { useEffect, useState } from 'react'
import { DoctorList } from '@/components/doctors/DoctorList'
import type { Doctor } from '@/components/doctors/DoctorList'
import { RefreshCw } from 'lucide-react'

export default function DoctorsSettingsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDoctors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/doctors')
      const result = await response.json()

      if (result.success) {
        setDoctors(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDoctors()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">로딩 중...</span>
      </div>
    )
  }

  return (
    <div>
      <DoctorList doctors={doctors} onUpdate={fetchDoctors} />
    </div>
  )
}
