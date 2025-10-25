import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET: 특정 패턴 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const pattern = await prisma.doctorPattern.findUnique({
      where: { id: params.id },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' }
        },
        doctor: {
          select: {
            id: true,
            name: true,
            rank: true
          }
        }
      }
    })

    if (!pattern) {
      return NextResponse.json(
        { success: false, error: 'Pattern not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: pattern })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: 패턴 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { patternName, isActive, days } = body

    // 패턴 존재 확인
    const existingPattern = await prisma.doctorPattern.findUnique({
      where: { id: params.id }
    })

    if (!existingPattern) {
      return NextResponse.json(
        { success: false, error: 'Pattern not found' },
        { status: 404 }
      )
    }

    // 트랜잭션으로 패턴과 요일 정보 업데이트
    const updatedPattern = await prisma.$transaction(async (tx) => {
      // 패턴 기본 정보 업데이트
      const pattern = await tx.doctorPattern.update({
        where: { id: params.id },
        data: {
          ...(patternName && { patternName }),
          ...(typeof isActive === 'boolean' && { isActive })
        }
      })

      // 요일 정보가 제공된 경우 업데이트
      if (days && Array.isArray(days)) {
        // 기존 요일 정보 삭제
        await tx.doctorPatternDay.deleteMany({
          where: { patternId: params.id }
        })

        // 새로운 요일 정보 생성
        await tx.doctorPatternDay.createMany({
          data: days.map((day: any) => ({
            patternId: params.id,
            dayOfWeek: day.dayOfWeek,
            isWorkday: day.isWorkday,
            hasNightShift: day.hasNightShift || false
          }))
        })
      }

      return pattern
    })

    // 업데이트된 패턴 전체 조회
    const fullPattern = await prisma.doctorPattern.findUnique({
      where: { id: params.id },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' }
        }
      }
    })

    return NextResponse.json({ success: true, data: fullPattern })
  } catch (error) {
    console.error('PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: 패턴 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 패턴 존재 확인
    const pattern = await prisma.doctorPattern.findUnique({
      where: { id: params.id }
    })

    if (!pattern) {
      return NextResponse.json(
        { success: false, error: 'Pattern not found' },
        { status: 404 }
      )
    }

    // 활성화된 패턴인지 확인 (활성화된 패턴은 삭제 방지)
    if (pattern.isActive) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete active pattern. Deactivate it first.' },
        { status: 400 }
      )
    }

    // 패턴 삭제 (Cascade로 연관된 DoctorPatternDay도 자동 삭제)
    await prisma.doctorPattern.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Pattern deleted successfully'
    })
  } catch (error) {
    console.error('DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
