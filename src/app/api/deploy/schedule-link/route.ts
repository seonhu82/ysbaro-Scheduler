/**
 * 스케줄 링크 생성 API
 * POST: 스케줄을 배포하고 공개 링크 생성
 * GET: 배포된 스케줄 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from '@/lib/utils/api-response'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: any = {
      clinicId: session.user.clinicId
    }

    if (year) {
      where.year = parseInt(year)
    }
    if (month) {
      where.month = parseInt(month)
    }

    // 배포된 스케줄 목록 조회
    const deployments = await prisma.scheduleViewLink.findMany({
      where,
      include: {
        clinic: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const deploymentList = deployments.map(d => ({
      id: d.id,
      clinicId: d.clinicId,
      clinicName: d.clinic.name,
      year: d.year,
      month: d.month,
      publicToken: d.token,
      publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/schedule-view/${d.token}`,
      deployedAt: d.createdAt.toISOString(),
      expiresAt: d.expiresAt?.toISOString() || null,
      isActive: !d.expiresAt || d.expiresAt > new Date()
    }))

    return successResponse(deploymentList)
  } catch (error) {
    console.error('Get deployments error:', error)
    return errorResponse('Failed to fetch deployments', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { year, month, expiryDays = 30 } = body

    if (!year || !month) {
      return badRequestResponse('Year and month are required')
    }

    // 공개 토큰 생성
    const publicToken = randomBytes(16).toString('hex')

    // 만료일 계산
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 기본 30일

    // 배포 생성
    const deployment = await prisma.scheduleViewLink.create({
      data: {
        clinicId: session.user.clinicId,
        year: parseInt(year),
        month: parseInt(month),
        token: publicToken,
        expiresAt
      },
      include: {
        clinic: {
          select: {
            name: true
          }
        }
      }
    })

    return successResponse(
      {
        id: deployment.id,
        clinicId: deployment.clinicId,
        clinicName: deployment.clinic.name,
        year: deployment.year,
        month: deployment.month,
        publicToken: deployment.token,
        publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/schedule-view/${deployment.token}`,
        deployedAt: deployment.createdAt.toISOString(),
        expiresAt: deployment.expiresAt?.toISOString() || null
      },
      'Schedule deployed successfully'
    )
  } catch (error) {
    console.error('Deploy schedule error:', error)
    return errorResponse('Failed to deploy schedule', 500)
  }
}
