// 원장 패턴 조회/생성

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const doctorId = searchParams.get('doctorId')

    if (!doctorId) {
      return NextResponse.json(
        { success: false, error: 'Doctor ID is required' },
        { status: 400 }
      )
    }

    const patterns = await prisma.doctorPattern.findMany({
      where: { doctorId },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: patterns,
    })
  } catch (error) {
    console.error('GET /api/doctor-pattern error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { doctorId, patternName, days } = body

    if (!doctorId || !patternName || !days) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 기존 활성 패턴 비활성화
    await prisma.doctorPattern.updateMany({
      where: {
        doctorId,
        isActive: true,
      },
      data: { isActive: false },
    })

    // 새 패턴 생성
    const pattern = await prisma.doctorPattern.create({
      data: {
        doctorId,
        patternName,
        isActive: true,
        days: {
          create: days.map((day: any) => ({
            dayOfWeek: day.dayOfWeek,
            isWorkday: day.isWorkday,
            hasNightShift: day.hasNightShift,
          })),
        },
      },
      include: {
        days: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: pattern,
    })
  } catch (error) {
    console.error('POST /api/doctor-pattern error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
