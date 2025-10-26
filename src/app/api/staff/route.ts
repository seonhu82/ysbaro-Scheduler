// 직원 목록 조회/생성

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
    const session = await auth()

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
    const { name, rank, pin, phoneNumber, email, workType } = body

    // 유효성 검사
    if (!name || !rank || !pin) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // workType 기본값 설정
    const finalWorkType = workType || 'WEEK_5'

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
        birthDate: new Date(),
        birthDateStr: '000101',
        departmentName: '미지정',
        categoryName: '미지정',
        workType: finalWorkType,
        workDays: finalWorkType === 'WEEK_4' ? 4 : 5, // workType에 맞춰 workDays도 설정
        rank,
        pin,
        phoneNumber,
        email,
        isActive: true,
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
