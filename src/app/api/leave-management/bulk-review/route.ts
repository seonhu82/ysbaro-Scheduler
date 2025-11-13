/**
 * 연차/오프 신청 일괄 검토 API
 * POST /api/leave-management/bulk-review
 *
 * 마법사 Step 2에서 호출:
 * - PENDING 상태의 모든 신청을 승인으로 처리
 * - 신청 시 이미 편차 검증이 완료되었으므로 모두 승인
 * - 에러 발생 시에만 ON_HOLD
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

        console.log(`   📝 ${staff.name}: ${application.leaveType} (편차 필터 통과)`)

        // 모든 PENDING 신청은 승인으로 처리 (신청 시 이미 편차 검증 완료)
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
