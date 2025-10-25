/**
 * 형평성 기반 신청 자격 확인 API
 * GET /api/fairness/check-eligibility?staffId=xxx&startDate=xxx&endDate=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonthlyFairness, checkYearlyFairness } from '@/lib/services/fairness-validation-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!staffId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // 월별 형평성 체크
    const monthlyCheck = await checkMonthlyFairness(staffId, start, end)

    // 연간 형평성 체크
    const yearlyCheck = await checkYearlyFairness(staffId, start.getFullYear())

    // 신청 가능 여부 판단
    const canApply = monthlyCheck.canApplyOff && yearlyCheck.canApplyOff

    return NextResponse.json({
      success: true,
      data: {
        canApply,
        monthlyCheck: {
          canApply: monthlyCheck.canApplyOff,
          currentOffDays: monthlyCheck.currentOffDays,
          minRequired: monthlyCheck.minRequired,
          remaining: monthlyCheck.remaining,
          message: monthlyCheck.canApplyOff
            ? `이번 달 오프 일수: ${monthlyCheck.currentOffDays}일 (최소 ${monthlyCheck.minRequired}일)`
            : `이번 달 최소 오프 일수(${monthlyCheck.minRequired}일)에 미달합니다. 현재 ${monthlyCheck.currentOffDays}일`
        },
        yearlyCheck: {
          canApply: yearlyCheck.canApplyOff,
          currentOffDays: yearlyCheck.currentOffDays,
          maxAllowed: yearlyCheck.maxAllowed,
          remaining: yearlyCheck.remaining,
          message: yearlyCheck.canApplyOff
            ? `올해 누적 오프 일수: ${yearlyCheck.currentOffDays}일 (최대 ${yearlyCheck.maxAllowed}일)`
            : `올해 최대 오프 일수(${yearlyCheck.maxAllowed}일)를 초과합니다. 현재 ${yearlyCheck.currentOffDays}일`
        },
        overallMessage: canApply
          ? '연차/오프 신청이 가능합니다'
          : '형평성 기준에 따라 현재 연차/오프 신청이 제한됩니다'
      }
    })
  } catch (error: any) {
    console.error('형평성 확인 오류:', error)
    return NextResponse.json(
      { success: false, error: error.message || '형평성 확인 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
