// 원장 목록 조회/생성

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const doctors = await prisma.doctor.findMany({
      where: { clinicId },
      include: {
        patterns: {
          where: { isActive: true },
          include: {
            days: {
              orderBy: { dayOfWeek: 'asc' },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: doctors,
    })
  } catch (error) {
    console.error('GET /api/doctors error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, specialization } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // 원장 및 기본 패턴 생성
    const doctor = await prisma.doctor.create({
      data: {
        clinicId,
        name,
        specialization,
        patterns: {
          create: {
            patternName: '기본 패턴',
            isActive: true,
            days: {
              create: [
                { dayOfWeek: 0, isWorkday: false, hasNightShift: false }, // 일
                { dayOfWeek: 1, isWorkday: true, hasNightShift: false },  // 월
                { dayOfWeek: 2, isWorkday: true, hasNightShift: false },  // 화
                { dayOfWeek: 3, isWorkday: true, hasNightShift: false },  // 수
                { dayOfWeek: 4, isWorkday: true, hasNightShift: false },  // 목
                { dayOfWeek: 5, isWorkday: true, hasNightShift: false },  // 금
                { dayOfWeek: 6, isWorkday: true, hasNightShift: true },   // 토
              ],
            },
          },
        },
      },
      include: {
        patterns: {
          include: { days: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: doctor,
    })
  } catch (error) {
    console.error('POST /api/doctors error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
