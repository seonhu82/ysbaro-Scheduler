'use client'

import { useEffect, useState } from 'react'
import { StaffList } from '@/components/staff/StaffList'
import type { Staff } from '@/components/staff/StaffList'
import { RefreshCw } from 'lucide-react'

export default function StaffSettingsPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/staff?includeInactive=true')
      const result = await response.json()

      if (result.success) {
        setStaff(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStaff()
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
      <StaffList staff={staff} onUpdate={fetchStaff} />
    </div>
  )
}
