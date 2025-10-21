// 직원 목록 조회/생성

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

    const { searchParams } = new URL(request.url)
    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    // 직원 목록 조회
    const staff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: searchParams.get('includeInactive') === 'true' ? undefined : true,
      },
      orderBy: [
        { rank: 'asc' },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({
      success: true,
      data: staff.map(s => ({
        ...s,
        pin: undefined, // PIN은 보안상 제외
      })),
    })
  } catch (error) {
    console.error('GET /api/staff error:', error)
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
    const { name, rank, pin, phoneNumber, email } = body

    // 유효성 검사
    if (!name || !rank || !pin) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // PIN 중복 체크
    const existingPin = await prisma.staff.findFirst({
      where: {
        clinicId,
        pin,
      },
    })

    if (existingPin) {
      return NextResponse.json(
        { success: false, error: 'PIN already exists' },
        { status: 400 }
      )
    }

    // 직원 생성
    const staff = await prisma.staff.create({
      data: {
        clinicId,
        name,
        rank,
        pin,
        phoneNumber,
        email,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...staff,
        pin: undefined, // PIN은 보안상 제외
      },
    })
  } catch (error) {
    console.error('POST /api/staff error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
