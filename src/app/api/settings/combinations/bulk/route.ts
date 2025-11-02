import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/utils/api-response'

// POST: 조합 일괄 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { combinations } = body

    if (!Array.isArray(combinations)) {
      return NextResponse.json(
        { success: false, error: 'Invalid combinations data' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 조합 데이터 생성
    for (const combo of combinations) {
      await prisma.doctorCombination.create({
        data: {
          clinicId,
          name: combo.name,
          dayOfWeek: combo.dayOfWeek,
          requiredStaff: combo.requiredStaff || 0,
          departmentRequiredStaff: combo.departmentRequiredStaff || {},
          departmentCategoryStaff: combo.departmentCategoryStaff || {},
          doctors: combo.doctors || [],
          hasNightShift: combo.hasNightShift || false,
        }
      })
    }

    return successResponse(null, 'Combinations saved successfully')
  } catch (error) {
    console.error('Save combinations error:', error)
    return errorResponse('Failed to save combinations', 500)
  }
}
