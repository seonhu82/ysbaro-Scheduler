import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/utils/api-response'

// POST: 원장 정보 일괄 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { doctors } = body

    if (!Array.isArray(doctors)) {
      return NextResponse.json(
        { success: false, error: 'Invalid doctors data' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 기존 원장 삭제 후 재생성
    await prisma.doctor.deleteMany({
      where: { clinicId }
    })

    // 원장 데이터 생성
    for (const doctor of doctors) {
      await prisma.doctor.create({
        data: {
          clinicId,
          name: doctor.name,
          shortName: doctor.shortName || doctor.name.charAt(0),
          useCategory: doctor.useCategory || false,
          isActive: true,
        }
      })

      // TODO: DoctorCategory 테이블에 categories 저장
    }

    return successResponse(null, 'Doctors saved successfully')
  } catch (error) {
    console.error('Save doctors error:', error)
    return errorResponse('Failed to save doctors', 500)
  }
}
