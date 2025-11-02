/**
 * ON_HOLD 일괄 처리 API
 * POST /api/leave-management/on-hold/bulk-action
 *
 * Body:
 * - applicationIds: string[]
 * - action: 'APPROVE' | 'REJECT'
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { applicationIds, action } = body as {
      applicationIds: string[]
      action: 'APPROVE' | 'REJECT'
    }

    if (!applicationIds || applicationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Application IDs required' },
        { status: 400 }
      )
    }

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const clinicId = (session.user as any).clinicId

    console.log(`\n🔄 일괄 ${action}: ${applicationIds.length}건`)

    let successCount = 0
    const errors: string[] = []

    for (const applicationId of applicationIds) {
      try {
        // 권한 확인
        const application = await prisma.leaveApplication.findFirst({
          where: {
            id: applicationId,
            clinicId,
            status: 'ON_HOLD'
          }
        })

        if (!application) {
          errors.push(`Application ${applicationId} not found or not ON_HOLD`)
          continue
        }

        // 상태 업데이트
        await prisma.leaveApplication.update({
          where: { id: applicationId },
          data: {
            status: action === 'APPROVE' ? 'CONFIRMED' : 'REJECTED',
            holdReason: null,
            rejectionReason: action === 'REJECT' ? '관리자 일괄 거절' : undefined
          }
        })

        successCount++
      } catch (error) {
        console.error(`Failed to process ${applicationId}:`, error)
        errors.push(`Failed to process ${applicationId}`)
      }
    }

    console.log(`   ✅ 성공: ${successCount}건`)
    if (errors.length > 0) {
      console.log(`   ❌ 실패: ${errors.length}건`)
    }

    return NextResponse.json({
      success: true,
      successCount,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Bulk action error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process bulk action' },
      { status: 500 }
    )
  }
}
