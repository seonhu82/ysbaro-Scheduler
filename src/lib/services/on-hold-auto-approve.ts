import { prisma } from '@/lib/prisma'
import { findApprovableOnHoldApplications } from './category-slot-service'

/**
 * 연차/오프 취소 시 자동으로 ON_HOLD 신청을 승인합니다.
 *
 * @param clinicId 병원 ID
 * @param date 취소된 날짜
 * @param cancelledStaffCategory 취소한 직원의 구분
 */
export async function autoApproveOnHold(
  clinicId: string,
  date: Date,
  cancelledStaffCategory: string
) {
  try {
    // 1. 취소로 인해 생긴 여유 슬롯 1개
    const availableCount = 1

    // 2. 해당 날짜/구분의 승인 가능한 ON_HOLD 신청 찾기
    const approvableIds = await findApprovableOnHoldApplications(
      clinicId,
      date,
      availableCount
    )

    // 3. 승인
    const approvedApplications = []
    for (const id of approvableIds) {
      const updated = await prisma.leaveApplication.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          holdReason: null
        },
        include: {
          staff: {
            select: {
              name: true,
              categoryName: true
            }
          }
        }
      })

      approvedApplications.push(updated)
    }

    return {
      success: true,
      approvedCount: approvedApplications.length,
      approvedApplications
    }
  } catch (error) {
    console.error('Auto approve ON_HOLD error:', error)
    return {
      success: false,
      approvedCount: 0,
      error: (error as Error).message
    }
  }
}
