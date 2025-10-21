// 연차 신청 기간 생성/조회

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/utils'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: any = { clinicId }
    if (year) where.year = parseInt(year)
    if (month) where.month = parseInt(month)

    const links = await prisma.applicationLink.findMany({
      where,
      include: {
        slotLimits: {
          orderBy: { date: 'asc' },
        },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({
      success: true,
      data: links,
    })
  } catch (error) {
    console.error('GET /api/leave-management/period error:', error)
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
    const { year, month, expiresAt, slotLimits } = body

    if (!year || !month || !expiresAt || !slotLimits || !Array.isArray(slotLimits)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 기존 링크 확인
    const existing = await prisma.applicationLink.findFirst({
      where: { clinicId, year, month },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Application period already exists' },
        { status: 400 }
      )
    }

    // 신청 링크 생성
    const link = await prisma.applicationLink.create({
      data: {
        clinicId,
        token: generateToken(),
        year,
        month,
        expiresAt: new Date(expiresAt),
        status: 'ACTIVE',
        slotLimits: {
          create: slotLimits.map((slot: any) => ({
            date: new Date(slot.date),
            dayType: slot.dayType,
            maxSlots: slot.maxSlots,
          })),
        },
      },
      include: {
        slotLimits: {
          orderBy: { date: 'asc' },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: link,
    })
  } catch (error) {
    console.error('POST /api/leave-management/period error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
