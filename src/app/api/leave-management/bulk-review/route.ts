/**
 * 연차/오프 신청 일괄 검토 API
 * POST /api/leave-management/bulk-review
 *
 * 마법사 Step 2에서 호출:
 * - PENDING 상태의 모든 신청을 형평성 기준으로 자동 검토
 * - 형평성 충족 → CONFIRMED
 * - 형평성 부족 또는 슬롯 부족 → ON_HOLD
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

    // PENDING 상태의 모든 신청 조회 (선착순)
    const pendingApplications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        status: 'PENDING',
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

    console.log(`\n🔍 일괄 검토 시작: ${pendingApplications.length}건의 PENDING 신청`)

    let confirmedCount = 0
    let onHoldCount = 0

    for (const application of pendingApplications) {
      try {
        const staff = application.staff
        const applicationDate = new Date(application.date)
        const appYear = applicationDate.getFullYear()
        const appMonth = applicationDate.getMonth() + 1

        // 1. 형평성 점수 계산
        const fairnessScore = await calculateStaffFairnessV2(
          staff.id,
          clinicId,
          appYear,
          appMonth
        )

        console.log(`   📊 ${staff.name}: 형평성 ${fairnessScore.overallScore}점 (${application.leaveType})`)

        // 2. 연차/오프에 따른 승인 가능 여부 확인
        const fairnessCheck = canApplyLeaveType(fairnessScore, application.leaveType)

        if (!fairnessCheck.canApply) {
          // 형평성 부족 → ON_HOLD
          await prisma.leaveApplication.update({
            where: { id: application.id },
            data: {
              status: 'ON_HOLD',
              holdReason: `형평성 점수 부족 (현재 ${fairnessScore.overallScore}점, 필요 ${application.leaveType === 'ANNUAL' ? '60' : '75'}점 이상)`
            }
          })
          onHoldCount++
          console.log(`   ⏳ ON_HOLD: ${staff.name} (형평성 부족)`)
          continue
        }

        // 3. 슬롯 가용성 확인
        const categoryCheck = await checkCategoryAvailability(
          clinicId,
          applicationDate,
          0, // scheduleId 미확정 시점
          staff.categoryName || ''
        )

        if (categoryCheck.shouldHold) {
          // 슬롯 부족 → ON_HOLD
          await prisma.leaveApplication.update({
            where: { id: application.id },
            data: {
              status: 'ON_HOLD',
              holdReason: categoryCheck.reason || '카테고리 슬롯 부족'
            }
          })
          onHoldCount++
          console.log(`   ⏳ ON_HOLD: ${staff.name} (슬롯 부족)`)
          continue
        }

        // 4. 승인 가능 → CONFIRMED
        await prisma.leaveApplication.update({
          where: { id: application.id },
          data: {
            status: 'CONFIRMED',
            holdReason: null
          }
        })
        confirmedCount++
        console.log(`   ✅ CONFIRMED: ${staff.name}`)

      } catch (error) {
        console.error(`   ⚠️  검토 실패: ${application.staff.name}`, error)
        // 에러 발생 시 ON_HOLD로 안전하게 처리
        await prisma.leaveApplication.update({
          where: { id: application.id },
          data: {
            status: 'ON_HOLD',
            holdReason: '시스템 오류로 검토 보류'
          }
        })
        onHoldCount++
      }
    }

    console.log(`\n✅ 일괄 검토 완료:`)
    console.log(`   - 승인(CONFIRMED): ${confirmedCount}건`)
    console.log(`   - 보류(ON_HOLD): ${onHoldCount}건\n`)

    return NextResponse.json({
      success: true,
      results: {
        total: pendingApplications.length,
        confirmed: confirmedCount,
        onHold: onHoldCount
      }
    })

  } catch (error) {
    console.error('Bulk review error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to review applications' },
      { status: 500 }
    )
  }
}
