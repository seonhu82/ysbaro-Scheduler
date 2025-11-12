'use client'

import { ListView } from '@/components/leave-management/ListView'

export default function ListViewPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">연차 관리 - 목록뷰</h1>
      <ListView />
    </div>
  )
}
