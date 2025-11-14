/**
 * 공개 스케줄 조회 - 직원 목록 API
 * GET: 클리닉의 활성 직원 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Token으로 link 조회
    const link = await prisma.scheduleViewLink.findUnique({
      where: { token: params.token },
    })

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 만료 확인
    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 링크입니다' },
        { status: 401 }
      )
    }

    // 자동배치 사용 부서 조회
    const autoAssignDepartments = await prisma.department.findMany({
      where: {
        clinicId: link.clinicId,
        useAutoAssignment: true
      },
      select: {
        name: true
      }
    })

    const autoAssignDepartmentNames = autoAssignDepartments.map(d => d.name)

    // 자동배치 사용 부서의 활성 직원 목록 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: {
          in: autoAssignDepartmentNames
        }
      },
      select: {
        id: true,
        name: true,
        departmentName: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: staffList
    })
  } catch (error: any) {
    console.error('직원 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '직원 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
