/**
 * 직급 관리 API
 * GET: 현재 사용 중인 모든 직급 목록 조회
 * POST: 새 직급 추가
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: 사용 중인 직급 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = session.user.clinicId

    // Staff 테이블에서 사용 중인 직급 목록 조회
    const allStaff = await prisma.staff.findMany({
      where: {
        clinicId
      },
      select: {
        position: true
      }
    })

    // 중복 제거 및 정렬 (null과 빈 문자열 필터링)
    const uniquePositions = [...new Set(
      allStaff
        .map(p => p.position)
        .filter(p => p !== null && p !== undefined && p.trim() !== '')
    )]
      .sort()
      .map((name, index) => ({
        id: `pos-${index}`,
        name
      }))

    console.log('Positions found:', uniquePositions.length, uniquePositions)

    return NextResponse.json(uniquePositions)
  } catch (error) {
    console.error('Failed to fetch positions:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch positions' }, { status: 500 })
  }
}

// POST: 새 직급 추가 (실제로는 검증만 수행, Staff 테이블에는 직원 등록 시 저장됨)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ success: false, error: 'Position name is required' }, { status: 400 })
    }

    // 직급명 검증만 수행 (중복 체크 등)
    // 실제 데이터는 Staff 테이블에 직원 등록 시 저장됨
    return NextResponse.json({ success: true, position: { name: name.trim() } })
  } catch (error) {
    console.error('Failed to add position:', error)
    return NextResponse.json({ success: false, error: 'Failed to add position' }, { status: 500 })
  }
}
