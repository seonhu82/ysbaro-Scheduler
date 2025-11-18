/**
 * 생체인식 등록 링크 생성 API
 * POST /api/deploy/biometric-link
 *
 * 생체인식 등록용 영구 링크를 생성합니다.
 * 병원당 하나의 공용 토큰을 사용합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    // 병원별 공용 토큰 조회 (가장 오래된 ApplicationLink에서)
    let sharedToken = await prisma.applicationLink.findFirst({
      where: {
        clinicId,
        staffId: null // 전체 직원용
      },
      select: {
        token: true
      },
      orderBy: {
        createdAt: 'asc' // 가장 처음 생성된 토큰 사용
      }
    })

    // 공용 토큰이 없으면 새로 생성 (병원당 1회만)
    const token = sharedToken?.token ?? crypto.randomBytes(16).toString('hex')

    // 토큰이 새로 생성된 경우, 영구 ApplicationLink 생성
    if (!sharedToken) {
      // 영구 링크 생성 (만료 날짜를 10년 후로 설정)
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 10)

      await prisma.applicationLink.create({
        data: {
          clinicId,
          staffId: null,
          token,
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          expiresAt,
          status: 'ACTIVE'
        }
      })
    }

    // 생체인식 등록 URL 생성
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const publicUrl = `${baseUrl}/biometric-setup/${token}`

    return NextResponse.json({
      success: true,
      data: {
        token,
        publicUrl,
        message: '생체인식 등록 링크가 생성되었습니다.'
      }
    })
  } catch (error) {
    console.error('Biometric link creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create biometric link' },
      { status: 500 }
    )
  }
}
