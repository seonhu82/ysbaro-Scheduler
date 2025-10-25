/**
 * 주간 자동 배치 API
 *
 * POST /api/schedule/weekly-assign
 * - weekInfoId를 받아 해당 주차의 직원 배치를 자동으로 수행
 * - 형평성 설정 기반 선택적 적용
 * - 주4일/주5일 근무 보장
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { autoAssignWeeklySchedule } from '@/lib/algorithms/weekly-assign-v2'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()

    if (!session?.user) {
      return unauthorizedResponse()
    }

    // 권한 확인 (ADMIN 또는 MANAGER만 가능)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return errorResponse('권한이 없습니다', 403)
    }

    // 요청 데이터 파싱
    const body = await request.json()
    const { weekInfoId } = body

    if (!weekInfoId) {
      return errorResponse('weekInfoId는 필수입니다', 400)
    }

    console.log(`\n========== 주간 자동 배치 시작 ==========`)
    console.log(`WeekInfo ID: ${weekInfoId}`)
    console.log(`요청자: ${session.user.name} (${session.user.role})`)
    console.log(`시작 시간: ${new Date().toLocaleString('ko-KR')}`)

    // 주간 배치 실행
    const result = await autoAssignWeeklySchedule(weekInfoId)

    console.log(`\n========== 주간 자동 배치 완료 ==========`)
    console.log(`성공 여부: ${result.success ? '✅ 성공' : '❌ 실패'}`)
    console.log(`배치 인원: ${result.assignedCount}명`)
    console.log(`미해결 이슈: ${result.unresolvedIssues.length}건`)
    console.log(`완료 시간: ${new Date().toLocaleString('ko-KR')}`)

    if (result.unresolvedIssues.length > 0) {
      console.log(`\n미해결 이슈 목록:`)
      result.unresolvedIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity}] ${issue.message}`)
        if (issue.suggestion) {
          console.log(`     → ${issue.suggestion}`)
        }
      })
    }

    return successResponse({
      ...result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('주간 배치 API 오류:', error)

    return errorResponse(
      error.message || '주간 배치 중 오류가 발생했습니다',
      500
    )
  }
}
