/**
 * 개별 원장 패턴 관리 API
 * PATCH: 패턴 업데이트
 * DELETE: 패턴 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from '@/lib/utils/api-response'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { id } = params
    const body = await request.json()
    const { patternName, isActive, days } = body

    // 패턴 조회 및 권한 확인
    const pattern = await prisma.doctorPattern.findUnique({
      where: { id },
      include: {
        doctor: true
      }
    })

    if (!pattern) {
      return notFoundResponse('Pattern not found')
    }

    if (pattern.doctor.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 업데이트 데이터 구성
    const updateData: any = {}
    if (patternName !== undefined) updateData.patternName = patternName
    if (isActive !== undefined) updateData.isActive = isActive

    // 패턴 업데이트
    const updatedPattern = await prisma.doctorPattern.update({
      where: { id },
      data: updateData,
      include: {
        doctor: {
          select: {
            name: true
          }
        },
        days: {
          orderBy: {
            dayOfWeek: 'asc'
          }
        }
      }
    })

    // 요일별 설정 업데이트 (제공된 경우)
    if (days && Array.isArray(days)) {
      // 기존 요일 설정 삭제 후 재생성
      await prisma.doctorPatternDay.deleteMany({
        where: { patternId: id }
      })

      await prisma.doctorPatternDay.createMany({
        data: days.map((day: any) => ({
          patternId: id,
          dayOfWeek: day.dayOfWeek,
          isWorkday: day.isWorkday,
          hasNightShift: day.hasNightShift
        }))
      })

      // 업데이트된 요일 정보 다시 조회
      const updatedDays = await prisma.doctorPatternDay.findMany({
        where: { patternId: id },
        orderBy: { dayOfWeek: 'asc' }
      })

      return successResponse(
        {
          id: updatedPattern.id,
          doctorId: updatedPattern.doctorId,
          doctorName: updatedPattern.doctor.name,
          patternName: updatedPattern.patternName,
          isActive: updatedPattern.isActive,
          days: updatedDays.map(day => ({
            dayOfWeek: day.dayOfWeek,
            isWorkday: day.isWorkday,
            hasNightShift: day.hasNightShift
          }))
        },
        'Pattern updated successfully'
      )
    }

    return successResponse(
      {
        id: updatedPattern.id,
        doctorId: updatedPattern.doctorId,
        doctorName: updatedPattern.doctor.name,
        patternName: updatedPattern.patternName,
        isActive: updatedPattern.isActive,
        days: updatedPattern.days.map(day => ({
          dayOfWeek: day.dayOfWeek,
          isWorkday: day.isWorkday,
          hasNightShift: day.hasNightShift
        }))
      },
      'Pattern updated successfully'
    )
  } catch (error) {
    console.error('Update pattern error:', error)
    return errorResponse('Failed to update pattern', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { id } = params

    // 패턴 조회 및 권한 확인
    const pattern = await prisma.doctorPattern.findUnique({
      where: { id },
      include: {
        doctor: true
      }
    })

    if (!pattern) {
      return notFoundResponse('Pattern not found')
    }

    if (pattern.doctor.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 활성 패턴 삭제 방지
    if (pattern.isActive) {
      return badRequestResponse('Cannot delete active pattern. Please deactivate it first.')
    }

    // 패턴 삭제 (cascade로 days도 자동 삭제됨)
    await prisma.doctorPattern.delete({
      where: { id }
    })

    return successResponse(null, 'Pattern deleted successfully')
  } catch (error) {
    console.error('Delete pattern error:', error)
    return errorResponse('Failed to delete pattern', 500)
  }
}
