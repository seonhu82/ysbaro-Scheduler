'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, List, Users, Link as LinkIcon, MessageCircle } from 'lucide-react'
import { PeriodManagement } from '@/components/leave-management/PeriodManagement'
import { CalendarView } from '@/components/leave-management/CalendarView'
import { ListView } from '@/components/leave-management/ListView'
import { StaffView } from '@/components/leave-management/StaffView'
import { KakaoSettings } from '@/components/leave-management/KakaoSettings'

export default function LeaveManagementPage() {
  const [activeTab, setActiveTab] = useState('period')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">연차/오프 관리</h1>
        <p className="text-gray-600">
          직원들의 연차 및 오프 신청을 관리합니다
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="period" className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">신청 기간</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">달력뷰</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">목록뷰</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">직원별뷰</span>
          </TabsTrigger>
          <TabsTrigger value="kakao" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            <span className="hidden sm:inline">카카오톡</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="period" className="space-y-4">
          <PeriodManagement />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <CalendarView />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <ListView />
        </TabsContent>

        <TabsContent value="staff" className="space-y-4">
          <StaffView />
        </TabsContent>

        <TabsContent value="kakao" className="space-y-4">
          <KakaoSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
