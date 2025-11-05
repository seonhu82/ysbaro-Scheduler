/**
 * 공개 연차/오프 신청 - 직원 목록 API
 * GET /api/leave-apply/[token]/staff-list
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    console.log('📋 직원 목록 요청:', params.token)

    // Token으로 link 조회
    const link = await prisma.applicationLink.findUnique({
      where: { token: params.token },
    })

    console.log('🔗 ApplicationLink 조회:', link ? `찾음 (clinicId: ${link.clinicId})` : '없음')

    if (!link) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 토큰입니다' },
        { status: 404 }
      )
    }

    // 자동배치를 사용하는 부서 목록 조회
    const autoAssignDepartments = await prisma.department.findMany({
      where: {
        clinicId: link.clinicId,
        useAutoAssignment: true,
      },
      select: {
        name: true,
      },
    })

    const autoAssignDepartmentNames = autoAssignDepartments.map(d => d.name)
    console.log('🏢 자동배치 사용 부서:', autoAssignDepartmentNames)

    // 해당 병원의 활성화된 직원 중 자동배치 사용 부서만 조회
    const staffList = await prisma.staff.findMany({
      where: {
        clinicId: link.clinicId,
        isActive: true,
        departmentName: {
          in: autoAssignDepartmentNames,
        },
      },
      select: {
        id: true,
        name: true,
        departmentName: true,
        pinCode: true, // PIN 설정 여부 확인용
      },
      orderBy: [
        { departmentName: 'asc' },
        { name: 'asc' },
      ],
    })

    console.log('✅ 직원 목록 조회 성공:', staffList.length, '명')
    console.log('👥 직원:', staffList.map(s => `${s.name}(${s.departmentName})`))

    return NextResponse.json({
      success: true,
      data: staffList,
    })
  } catch (error: any) {
    console.error('❌ 직원 목록 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '직원 목록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}
