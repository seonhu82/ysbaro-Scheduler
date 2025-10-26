/**
 * 근무 형태 설정 페이지
 * 경로: /settings/work-type
 *
 * 기능:
 * - 주4일/주5일 기본 설정
 * - 직급별 기본 근무 형태 설정
 */

'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Clock, Users, CheckCircle } from 'lucide-react'

export default function WorkTypeSettingsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Briefcase className="w-8 h-8" />
          근무 형태 관리
        </h1>
        <p className="text-gray-600">
          직원의 근무 형태(주4일/주5일)를 설정하고 관리합니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 근무 형태 설명 */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            근무 형태 종류
          </h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex-shrink-0 mt-1">
                <CheckCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-blue-900">주5일 근무 (전일제)</h3>
                  <Badge className="bg-blue-600">WEEK_5</Badge>
                </div>
                <p className="text-sm text-blue-800 mb-2">
                  월요일부터 금요일까지 주 5일 근무하는 전일제 직원입니다.
                </p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 주당 5일 배치</li>
                  <li>• 토요일, 일요일 선택적 근무 가능</li>
                  <li>• 기본 근무 형태</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex-shrink-0 mt-1">
                <CheckCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-orange-900">주4일 근무 (파트타임)</h3>
                  <Badge className="bg-orange-600">WEEK_4</Badge>
                </div>
                <p className="text-sm text-orange-800 mb-2">
                  주 4일만 근무하는 파트타임 직원입니다.
                </p>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• 주당 4일 배치</li>
                  <li>• 스케줄 자동 배치 시 4일만 배치됨</li>
                  <li>• 파트타임 계약직에 적합</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>

        {/* 설정 방법 안내 */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            근무 형태 설정 방법
          </h2>

          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs">
                1
              </span>
              <div>
                <p className="font-medium mb-1">직원 등록 시 설정</p>
                <p className="text-gray-600">
                  새 직원 추가 시 "근무 형태" 드롭다운에서 주4일 또는 주5일을 선택합니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs">
                2
              </span>
              <div>
                <p className="font-medium mb-1">기존 직원 정보 수정</p>
                <p className="text-gray-600">
                  직원 목록에서 "수정" 버튼을 클릭하여 근무 형태를 변경할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs">
                3
              </span>
              <div>
                <p className="font-medium mb-1">스케줄 자동 배치</p>
                <p className="text-gray-600">
                  주간 배치 시스템이 각 직원의 근무 형태를 고려하여 자동으로 배치합니다.
                  주4일 직원은 4일만, 주5일 직원은 5일 배치됩니다.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* 주의사항 */}
        <Card className="p-6 bg-amber-50 border-amber-200">
          <h2 className="text-lg font-semibold mb-3 text-amber-900">
            참고 사항
          </h2>
          <ul className="space-y-2 text-sm text-amber-800">
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">•</span>
              <span>근무 형태는 직원별로 개별 설정됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">•</span>
              <span>기존 직원의 근무 형태가 설정되지 않은 경우 주5일(WEEK_5)로 기본 처리됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">•</span>
              <span>근무 형태 변경 시 다음 주차 스케줄부터 반영됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 mt-0.5">•</span>
              <span>연차 및 오프는 근무 형태와 관계없이 신청 가능합니다.</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
