/**
 * 카카오 API 설정 API
 * GET: 카카오 API 키 조회
 * POST: 카카오 API 키 저장
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

    // 카카오 API 설정 조회
    const settings = await prisma.kakaoSettings.findUnique({
      where: {
        clinicId: session.user.clinicId
      },
      select: {
        javascriptKey: true
      }
    })

    if (!settings || !settings.javascriptKey) {
      return successResponse({ apiKey: null, isEnabled: false })
    }

    return successResponse({
      apiKey: settings.javascriptKey,
      isEnabled: true
    })
  } catch (error) {
    console.error('Get Kakao settings error:', error)
    return successResponse({ apiKey: null, isEnabled: false })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return errorResponse('JavaScript 키가 필요합니다', 400)
    }

    // 카카오 API 설정 저장
    const settings = await prisma.kakaoSettings.upsert({
      where: {
        clinicId: session.user.clinicId
      },
      update: {
        javascriptKey: apiKey
      },
      create: {
        clinicId: session.user.clinicId,
        javascriptKey: apiKey
      }
    })

    return successResponse(
      {
        apiKey: settings.javascriptKey,
        isEnabled: true
      },
      '카카오 JavaScript 키가 저장되었습니다'
    )
  } catch (error) {
    console.error('Save Kakao settings error:', error)
    return errorResponse('설정 저장에 실패했습니다', 500)
  }
}
