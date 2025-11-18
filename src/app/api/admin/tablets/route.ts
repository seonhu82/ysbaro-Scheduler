import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/tablets
 * 모든 병원의 태블릿 상태 조회 (SUPER_ADMIN 전용)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    // SUPER_ADMIN만 접근 가능
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // 모든 병원 조회
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
            staff: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 각 병원별 태블릿 정보 생성
    const tablets = await Promise.all(
      clinics.map(async (clinic) => {
        // QR 토큰 조회
        const qrTokens = await prisma.qRToken.findMany({
          where: {
            clinicId: clinic.id,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        })

        // 생체인식 링크 조회 - 아직 구현되지 않음
        const biometricLinks: any[] = []

        // 수동 배치 링크 조회
        const manualAssignLinks = await prisma.manualAssignLink.findMany({
          where: {
            clinicId: clinic.id,
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        })

        // 생체인식 등록된 직원 수
        const staffWithBiometric = await prisma.staff.count({
          where: {
            clinicId: clinic.id,
            biometricEnabled: true,
          },
        })

        // 최근 출퇴근 기록 (태블릿 사용 여부 확인)
        const recentAttendance = await prisma.attendanceRecord.findFirst({
          where: {
            clinicId: clinic.id,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
            checkMethod: true,
          },
        })

        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

        return {
          clinic: {
            id: clinic.id,
            name: clinic.name,
            phone: clinic.phone,
            address: clinic.address,
            userCount: clinic._count.users,
            staffCount: clinic._count.staff,
          },
          tablets: {
            attendance: {
              url: `${baseUrl}/tablet/attendance?clinicId=${clinic.id}`,
              token: null, // 토큰 불필요
              expiresAt: null, // 만료 없음
              status: 'active', // 항상 활성
            },
            biometric: {
              url: biometricLinks[0]
                ? `${baseUrl}/biometric-setup?token=${biometricLinks[0].token}`
                : null,
              token: biometricLinks[0]?.token || null,
              expiresAt: biometricLinks[0]?.expiresAt || null,
              registeredCount: staffWithBiometric,
              totalStaff: clinic._count.staff,
              status: biometricLinks[0] ? 'active' : 'inactive',
            },
            manualAssign: {
              url: manualAssignLinks[0]
                ? `${baseUrl}/manual-assign?token=${manualAssignLinks[0].token}`
                : null,
              token: manualAssignLinks[0]?.token || null,
              expiresAt: manualAssignLinks[0]?.expiresAt || null,
              status: manualAssignLinks[0] ? 'active' : 'inactive',
            },
          },
          lastActivity: {
            timestamp: recentAttendance?.createdAt || null,
            method: recentAttendance?.checkMethod || null,
          },
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: tablets,
    })
  } catch (error) {
    console.error('GET /api/admin/tablets error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tablet status' },
      { status: 500 }
    )
  }
}
