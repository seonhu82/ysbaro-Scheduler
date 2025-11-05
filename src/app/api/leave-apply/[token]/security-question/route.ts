/**
 * 보안 질문 조회 API
 * GET /api/leave-apply/[token]/security-question?staffId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')

    if (!staffId) {
      return NextResponse.json(
        { success: false, error: '직원 ID가 필요합니다' },
        { status: 400 }
      )
    }

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 직원 조회
    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        clinicId: link.clinicId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        securityQuestion: true,
      }
    })

    if (!staff) {
      return NextResponse.json(
        { success: false, error: '직원 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        hasSecurityQuestion: !!staff.securityQuestion,
        securityQuestion: staff.securityQuestion || null,
      }
    })
  } catch (error: any) {
    console.error('보안 질문 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '보안 질문 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
