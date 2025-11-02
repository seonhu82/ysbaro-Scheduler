'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, MapPin, Phone, Save } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface ClinicInfo {
  name: string
  address: string
  phone: string
}

export default function ClinicInfoSettingsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({
    name: '',
    address: '',
    phone: ''
  })

  // 데이터 로드
  useEffect(() => {
    const fetchClinicInfo = async () => {
      try {
        const res = await fetch('/api/settings/clinic-info')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setClinicInfo({
              name: data.data.name || '',
              address: data.data.address || '',
              phone: data.data.phone || ''
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch clinic info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchClinicInfo()
  }, [])

  const handleSave = async () => {
    if (!clinicInfo.name || !clinicInfo.phone) {
      alert('병원명과 전화번호는 필수입니다.')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/settings/clinic-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicInfo)
      })

      if (res.ok) {
        alert('저장되었습니다.')
      } else {
        const error = await res.json()
        alert(`저장 실패: ${error.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">기본 정보 수정</h1>
        <p className="text-gray-600 mt-2">병원의 기본 정보를 수정합니다</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>병원 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 병원명 */}
          <div className="space-y-2">
            <Label htmlFor="clinic-name" className="text-base font-medium">
              병원명 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="clinic-name"
                value={clinicInfo.name}
                onChange={(e) => setClinicInfo({ ...clinicInfo, name: e.target.value })}
                className="pl-10 h-11 text-base"
                placeholder="연세바로치과"
                required
              />
            </div>
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <Label htmlFor="clinic-address" className="text-base font-medium">
              주소
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="clinic-address"
                value={clinicInfo.address}
                onChange={(e) => setClinicInfo({ ...clinicInfo, address: e.target.value })}
                className="pl-10 h-11 text-base"
                placeholder="서울시 강남구..."
              />
            </div>
          </div>

          {/* 전화번호 */}
          <div className="space-y-2">
            <Label htmlFor="clinic-phone" className="text-base font-medium">
              전화번호 <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <Input
                id="clinic-phone"
                value={clinicInfo.phone}
                onChange={(e) => setClinicInfo({ ...clinicInfo, phone: e.target.value })}
                className="pl-10 h-11 text-base"
                placeholder="02-1234-5678"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
