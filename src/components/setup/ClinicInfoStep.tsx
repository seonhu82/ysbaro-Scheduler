'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, MapPin, Phone } from 'lucide-react'

interface ClinicInfoStepProps {
  data: {
    name: string
    address: string
    phone: string
  }
  onChange: (data: { name: string; address: string; phone: string }) => void
}

export function ClinicInfoStep({ data, onChange }: ClinicInfoStepProps) {
  const handleChange = (field: 'name' | 'address' | 'phone', value: string) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          병원 기본 정보
        </h2>
        <p className="text-gray-600">
          병원의 기본 정보를 입력해주세요
        </p>
      </div>

      <div className="space-y-5">
        {/* 병원명 */}
        <div className="space-y-2">
          <Label htmlFor="clinic-name" className="text-base font-medium">
            병원명 <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              id="clinic-name"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="pl-10 h-11 text-base"
              placeholder="연세바로치과"
              required
            />
          </div>
        </div>

        {/* 주소 */}
        <div className="space-y-2">
          <Label htmlFor="clinic-address" className="text-base font-medium">
            주소 <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              id="clinic-address"
              value={data.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="pl-10 h-11 text-base"
              placeholder="서울시 강남구..."
              required
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
              value={data.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="pl-10 h-11 text-base"
              placeholder="02-1234-5678"
              required
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900">
          💡 <strong>안내:</strong> 입력하신 정보는 시스템 전반에서 사용되며,
          나중에 설정 페이지에서 변경할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
