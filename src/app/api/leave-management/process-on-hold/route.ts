/**
 * ON_HOLD 신청 자동 재검토 및 승인 API
 * POST /api/leave-management/process-on-hold
 *
 * 스케줄 확정 후 호출:
 * - ON_HOLD 상태 신청들을 재검토
 * - 슬롯 여유 + 형평성 충족 → 자동 승인
 * - 여전히 불가 → 그대로 유지 또는 거절
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStaffFairnessV2, canApplyLeaveType } from '@/lib/services/fairness-calculator-v2'
import { checkCategoryAvailability } from '@/lib/services/category-slot-service'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { year, month } = body

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month required' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    // ON_HOLD 상태의 모든 신청 조회
    const onHoldApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'ON_HOLD',
        date: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0)
        }
      },
      include: {
        staff: true
      },
      orderBy: {
        createdAt: 'asc' // 선착순
      }
    })

    console.log(`\n🔄 ON_HOLD 자동 재검토 시작: ${onHoldApplications.length}건`)

    let approvedCount = 0
    let rejectedCount = 0
    let remainOnHoldCount = 0

    for (const application of onHoldApplications) {
      try {
        const staff = application.staff
        const applicationDate = new Date(application.date)
        const appYear = applicationDate.getFullYear()
        const appMonth = applicationDate.getMonth() + 1

        // 1. 형평성 점수 재계산
        const fairnessScore = await calculateStaffFairnessV2(
          staff.id,
          clinicId,
          appYear,
          appMonth
        )

        // 2. 연차/오프에 따른 승인 가능 여부 확인
        const fairnessCheck = canApplyLeaveType(fairnessScore, application.leaveType)

        if (!fairnessCheck.canApply) {
          // 형평성 여전히 부족 → 거절로 변경
          await prisma.leaveApplication.update({
            where: { id: application.id },
            data: {
              status: 'REJECTED',
              holdReason: null
              // rejectionReason: fairnessCheck.reason // 스키마 업데이트 후 활성화
            }
          })
          rejectedCount++
          console.log(`   ❌ 거절: ${staff.name} (형평성 ${fairnessScore.overallScore}점 부족)`)
          continue
        }

        // 3. 슬롯 가용성 재확인
        const categoryCheck = await checkCategoryAvailability(
          clinicId,
          applicationDate,
          0,
          staff.categoryName || ''
        )

        if (categoryCheck.shouldHold) {
          // 여전히 슬롯 부족 → 그대로 유지
          remainOnHoldCount++
          console.log(`   ⏳ 보류 유지: ${staff.name} (슬롯 부족)`)
          continue
        }

        // 4. 승인 가능 → CONFIRMED로 변경
        await prisma.leaveApplication.update({
          where: { id: application.id },
          data: {
            status: 'CONFIRMED',
            holdReason: null
          }
        })
        approvedCount++
        console.log(`   ✅ 자동 승인: ${staff.name} (${application.leaveType === 'ANNUAL' ? '연차' : '오프'})`)

      } catch (error) {
        console.error(`   ⚠️  처리 실패: ${application.staff.name}`, error)
        remainOnHoldCount++
      }
    }

    console.log(`\n✅ ON_HOLD 재검토 완료:`)
    console.log(`   - 자동 승인: ${approvedCount}건`)
    console.log(`   - 거절: ${rejectedCount}건`)
    console.log(`   - 보류 유지: ${remainOnHoldCount}건\n`)

    return NextResponse.json({
      success: true,
      results: {
        total: onHoldApplications.length,
        approved: approvedCount,
        rejected: rejectedCount,
        remainOnHold: remainOnHoldCount
      }
    })

  } catch (error) {
    console.error('ON_HOLD processing error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process ON_HOLD applications' },
      { status: 500 }
    )
  }
}
