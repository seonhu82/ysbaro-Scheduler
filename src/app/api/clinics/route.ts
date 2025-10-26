import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/clinics
 * 병원 목록 조회 (회원가입용)
 * 인증 불필요
 */
export async function GET() {
  try {
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        address: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(clinics)
  } catch (error) {
    console.error('Clinic list error:', error)
    return NextResponse.json(
      { error: '병원 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
