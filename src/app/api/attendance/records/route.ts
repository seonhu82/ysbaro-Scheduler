/**
 * 출퇴근 기록 조회 API
 * GET: 출퇴근 이력 조회
 * POST: 수동 출퇴근 기록 생성
 * DELETE: 출퇴근 기록 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/api-response'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const staffId = searchParams.get('staffId')
    const suspicious = searchParams.get('suspicious')
    const checkType = searchParams.get('checkType')
    const checkMethod = searchParams.get('checkMethod')

    const where: any = {
      clinicId: session.user.clinicId
    }

    // 날짜 필터
    if (startDate || endDate) {
      where.checkTime = {}
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        where.checkTime.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.checkTime.lte = end
      }
    }

    // 직원 필터
    if (staffId && staffId !== 'all') {
      where.staffId = staffId
    }

    // 출근/퇴근 필터
    if (checkType && (checkType === 'IN' || checkType === 'OUT')) {
      where.checkType = checkType
    }

    // 인증 방법 필터
    if (checkMethod && ['BIOMETRIC', 'PIN', 'QR', 'MANUAL'].includes(checkMethod)) {
      where.checkMethod = checkMethod
    }

    // 의심 패턴 필터
    if (suspicious === 'true') {
      where.isSuspicious = true
    } else if (suspicious === 'false') {
      where.isSuspicious = false
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
          }
        }
      },
      orderBy: {
        checkTime: 'desc'
      },
      take: 500 // 최대 500건
    })

    // 통계 계산
    const statistics = {
      total: records.length,
      checkIn: records.filter((r) => r.checkType === 'IN').length,
      checkOut: records.filter((r) => r.checkType === 'OUT').length,
      biometric: records.filter((r) => r.checkMethod === 'BIOMETRIC').length,
      pin: records.filter((r) => r.checkMethod === 'PIN').length,
      qr: records.filter((r) => r.checkMethod === 'QR').length,
      manual: records.filter((r) => r.checkMethod === 'MANUAL').length,
    }

    return successResponse({ records, statistics })
  } catch (error) {
    console.error('Get attendance records error:', error)
    return errorResponse('Failed to fetch records', 500)
  }
}

// 수동 출퇴근 기록 생성 (관리자용)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { staffId, checkType, checkTime, note } = await request.json()

    if (!staffId || !checkType || !checkTime) {
      return errorResponse('필수 정보가 누락되었습니다.', 400)
    }

    if (checkType !== 'IN' && checkType !== 'OUT') {
      return errorResponse('올바른 체크 타입이 아닙니다.', 400)
    }

    // 직원 확인
    const staff = await prisma.staff.findUnique({
      where: { id: staffId, clinicId: session.user.clinicId },
      select: {
        id: true,
        name: true,
      },
    })

    if (!staff) {
      return errorResponse('직원을 찾을 수 없습니다.', 404)
    }

    // 수동 출퇴근 기록 생성
    const checkTimeDate = new Date(checkTime);
    const dateOnly = new Date(checkTimeDate);
    dateOnly.setHours(0, 0, 0, 0);

    const attendanceRecord = await prisma.attendanceRecord.create({
      data: {
        clinicId: session.user.clinicId,
        staffId: staff.id,
        checkType,
        checkMethod: 'MANUAL',
        checkTime: checkTimeDate,
        date: dateOnly,
        deviceFingerprint: 'admin-manual',
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'admin',
        notes: note || null,
      },
    })

    console.log(`✅ [출퇴근] 수동 등록: ${staff.name} (${checkType})`)

    return successResponse({
      message: '출퇴근 기록이 수동으로 등록되었습니다.',
      record: attendanceRecord,
    })
  } catch (error) {
    console.error('Manual attendance record error:', error)
    return errorResponse('출퇴근 기록 등록에 실패했습니다.', 500)
  }
}

// 출퇴근 기록 삭제 (관리자용)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const recordId = searchParams.get('recordId')

    if (!recordId) {
      return errorResponse('기록 ID가 필요합니다.', 400)
    }

    // 기록 확인 및 삭제
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        id: recordId,
        clinicId: session.user.clinicId,
      },
    })

    if (!record) {
      return errorResponse('기록을 찾을 수 없습니다.', 404)
    }

    await prisma.attendanceRecord.delete({
      where: { id: recordId },
    })

    console.log(`✅ [출퇴근] 기록 삭제: ${recordId}`)

    return successResponse({ message: '출퇴근 기록이 삭제되었습니다.' })
  } catch (error) {
    console.error('Delete attendance record error:', error)
    return errorResponse('출퇴근 기록 삭제에 실패했습니다.', 500)
  }
}
