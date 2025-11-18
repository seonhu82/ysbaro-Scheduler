/**
 * 출퇴근 시간 설정 API
 * 경로: /api/attendance/time-settings
 *
 * 기능:
 * - GET: 출퇴근 시간 설정 조회
 * - POST: 출퇴근 시간 설정 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// 성공 응답 헬퍼
function successResponse(data: any) {
  return NextResponse.json({ success: true, data })
}

// 에러 응답 헬퍼
function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

// GET: 출퇴근 시간 설정 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return errorResponse('인증되지 않은 사용자입니다', 401)
    }

    const clinicId = session.user.clinicId

    // 기존 설정 조회
    let settings = await prisma.attendanceTimeSettings.findUnique({
      where: { clinicId }
    })

    // 설정이 없으면 기본값 생성
    if (!settings) {
      settings = await prisma.attendanceTimeSettings.create({
        data: {
          clinicId,
          weekdayTimes: {
            MONDAY: {
              operatingStart: '10:00',
              operatingEnd: '19:00',
              workStart: '09:30',
              workEnd: '17:00'
            },
            TUESDAY: {
              operatingStart: '10:00',
              operatingEnd: '19:00',
              workStart: '09:30',
              workEnd: '17:00'
            },
            WEDNESDAY: {
              operatingStart: '10:00',
              operatingEnd: '19:00',
              workStart: '09:30',
              workEnd: '17:00'
            },
            THURSDAY: {
              operatingStart: '10:00',
              operatingEnd: '19:00',
              workStart: '09:30',
              workEnd: '17:00'
            },
            FRIDAY: {
              operatingStart: '10:00',
              operatingEnd: '19:00',
              workStart: '09:30',
              workEnd: '17:00'
            },
            SATURDAY: {
              operatingStart: '10:00',
              operatingEnd: '15:00',
              workStart: '09:30',
              workEnd: '15:00'
            },
            SUNDAY: {
              operatingStart: '',
              operatingEnd: '',
              workStart: '',
              workEnd: ''
            }
          },
          nightShiftTime: {
            nightShiftStart: '18:00',
            nightShiftEnd: '21:00'
          }
        }
      })
    }

    return successResponse({ settings })

  } catch (error: any) {
    console.error('출퇴근 시간 설정 조회 오류:', error)
    return errorResponse('설정 조회 중 오류가 발생했습니다')
  }
}

// POST: 출퇴근 시간 설정 저장
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return errorResponse('인증되지 않은 사용자입니다', 401)
    }

    const clinicId = session.user.clinicId
    const body = await request.json()

    const { weekdayTimes, nightShiftTime } = body

    // 설정 업데이트
    const settings = await prisma.attendanceTimeSettings.upsert({
      where: { clinicId },
      update: {
        weekdayTimes,
        nightShiftTime
      },
      create: {
        clinicId,
        weekdayTimes,
        nightShiftTime
      }
    })

    return successResponse({
      message: '출퇴근 시간 설정이 저장되었습니다',
      settings
    })

  } catch (error: any) {
    console.error('출퇴근 시간 설정 저장 오류:', error)
    return errorResponse('설정 저장 중 오류가 발생했습니다')
  }
}
