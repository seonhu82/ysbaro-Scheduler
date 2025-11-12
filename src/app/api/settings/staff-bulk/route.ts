import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/utils/api-response'

// POST: 직원 정보 일괄 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { staff } = body

    if (!Array.isArray(staff)) {
      return NextResponse.json(
        { success: false, error: 'Invalid staff data' },
        { status: 400 }
      )
    }

    const clinicId = session.user.clinicId

    // 기존 직원 삭제 후 재생성 (위험! 실제로는 update/create 방식 권장)
    await prisma.staff.deleteMany({
      where: { clinicId }
    })

    // 직원 데이터 생성
    for (const s of staff) {
      // 생년월일 변환 (YYMMDD -> Date)
      const yy = parseInt(s.birthDate.slice(0, 2))
      const mm = parseInt(s.birthDate.slice(2, 4))
      const dd = parseInt(s.birthDate.slice(4, 6))

      // 유효성 검사
      if (isNaN(yy) || isNaN(mm) || isNaN(dd)) {
        return NextResponse.json(
          { success: false, error: `${s.name}: 생년월일 형식이 올바르지 않습니다 (YYMMDD 형식으로 입력하세요)` },
          { status: 400 }
        )
      }

      if (mm < 1 || mm > 12) {
        return NextResponse.json(
          { success: false, error: `${s.name}: 월은 01-12 사이여야 합니다 (입력: ${mm})` },
          { status: 400 }
        )
      }

      if (dd < 1 || dd > 31) {
        return NextResponse.json(
          { success: false, error: `${s.name}: 일은 01-31 사이여야 합니다 (입력: ${dd})` },
          { status: 400 }
        )
      }

      // 2000년대/1900년대 판단 (00-49는 2000년대, 50-99는 1900년대)
      const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy

      // UTC 기준으로 Date 생성 (타임존 문제 방지)
      const birthDate = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0))

      // Date 객체가 올바르게 생성되었는지 확인 (예: 2월 33일 같은 유효하지 않은 날짜 방지)
      if (birthDate.getUTCFullYear() !== yyyy ||
          birthDate.getUTCMonth() !== mm - 1 ||
          birthDate.getUTCDate() !== dd) {
        return NextResponse.json(
          { success: false, error: `${s.name}: 유효하지 않은 날짜입니다 (${yyyy}년 ${mm}월 ${dd}일)` },
          { status: 400 }
        )
      }

      // PIN 생성 (생년월일)
      const pin = s.birthDate

      // 입사일 처리
      let hireDate = null
      if (s.hireDate) {
        hireDate = new Date(s.hireDate)
      }

      await prisma.staff.create({
        data: {
          clinicId,
          name: s.name,
          birthDate,
          birthDateStr: s.birthDate,
          hireDate,
          departmentName: s.departmentName,
          categoryName: s.categoryName || null,
          position: s.position,
          workType: s.workType,
          workDays: s.workType === 'WEEK_4' ? 4 : 5,
          flexibleForCategories: s.flexibleForCategories || [],
          flexibilityPriority: s.flexibilityPriority || 0,
          pin,
          isActive: true,
          totalAnnualDays: s.totalAnnualDays || 15,
          usedAnnualDays: s.usedAnnualDays || 0,
        }
      })
    }

    return successResponse(null, 'Staff saved successfully')
  } catch (error) {
    console.error('Save staff error:', error)
    return errorResponse('Failed to save staff', 500)
  }
}
