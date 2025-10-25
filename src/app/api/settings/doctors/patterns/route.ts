/**
 * 원장 패턴 관리 API
 * GET: 패턴 목록 조회
 * POST: 새 패턴 생성
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const patterns = await prisma.doctorPattern.findMany({
      where: {
        doctor: {
          clinicId: session.user.clinicId
        }
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true
          }
        },
        days: {
          orderBy: {
            dayOfWeek: 'asc'
          }
        }
      },
      orderBy: [
        { doctor: { name: 'asc' } },
        { createdAt: 'desc' }
      ]
    })

    // UI에 맞게 데이터 변환
    const formattedPatterns = patterns.map(pattern => ({
      id: pattern.id,
      doctorId: pattern.doctorId,
      doctorName: pattern.doctor.name,
      patternName: pattern.patternName,
      isActive: pattern.isActive,
      days: pattern.days.map(day => ({
        dayOfWeek: day.dayOfWeek,
        isWorkday: day.isWorkday,
        hasNightShift: day.hasNightShift
      }))
    }))

    return successResponse(formattedPatterns)
  } catch (error) {
    console.error('Get patterns error:', error)
    return errorResponse('Failed to fetch patterns', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { doctorId, patternName } = body

    if (!doctorId || !patternName) {
      return badRequestResponse('Doctor ID and pattern name are required')
    }

    // 원장이 해당 clinic에 속하는지 확인
    const doctor = await prisma.doctor.findFirst({
      where: {
        id: doctorId,
        clinicId: session.user.clinicId
      }
    })

    if (!doctor) {
      return badRequestResponse('Doctor not found or does not belong to this clinic')
    }

    // 패턴 생성 (기본적으로 모든 요일 휴무)
    const pattern = await prisma.doctorPattern.create({
      data: {
        doctorId,
        patternName,
        isActive: false,
        days: {
          create: [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({
            dayOfWeek,
            isWorkday: false,
            hasNightShift: false
          }))
        }
      },
      include: {
        doctor: {
          select: {
            name: true
          }
        },
        days: true
      }
    })

    return successResponse(
      {
        id: pattern.id,
        doctorId: pattern.doctorId,
        doctorName: pattern.doctor.name,
        patternName: pattern.patternName,
        isActive: pattern.isActive,
        days: pattern.days.map(day => ({
          dayOfWeek: day.dayOfWeek,
          isWorkday: day.isWorkday,
          hasNightShift: day.hasNightShift
        }))
      },
      'Pattern created successfully'
    )
  } catch (error) {
    console.error('Create pattern error:', error)
    return errorResponse('Failed to create pattern', 500)
  }
}
