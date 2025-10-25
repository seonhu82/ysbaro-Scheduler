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
    const scheduleId = searchParams.get('scheduleId')

    const where: any = {
      schedule: {
        clinicId: session.user.clinicId
      }
    }

    if (scheduleId) {
      where.scheduleId = scheduleId
    }

    // 배포된 스케줄 목록 조회
    const deployments = await prisma.scheduleDeployment.findMany({
      where,
      include: {
        schedule: {
          select: {
            year: true,
            month: true,
            status: true
          }
        }
      },
      orderBy: {
        deployedAt: 'desc'
      }
    })

    const deploymentList = deployments.map(d => ({
      id: d.id,
      scheduleId: d.scheduleId,
      year: d.schedule.year,
      month: d.schedule.month,
      publicToken: d.publicToken,
      publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/schedule-view/${d.publicToken}`,
      deployedAt: d.deployedAt.toISOString(),
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
    const { scheduleId, expiryDays = 30 } = body

    if (!scheduleId) {
      return badRequestResponse('Schedule ID is required')
    }

    // 스케줄 조회 및 권한 확인
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    })

    if (!schedule) {
      return notFoundResponse('Schedule not found')
    }

    if (schedule.clinicId !== session.user.clinicId) {
      return unauthorizedResponse()
    }

    // 스케줄이 확정 상태가 아니면 배포 불가
    if (schedule.status !== 'CONFIRMED' && schedule.status !== 'DEPLOYED') {
      return badRequestResponse('Only confirmed schedules can be deployed')
    }

    // 공개 토큰 생성
    const publicToken = randomBytes(16).toString('hex')

    // 만료일 계산
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null

    // 배포 생성
    const deployment = await prisma.scheduleDeployment.create({
      data: {
        scheduleId,
        publicToken,
        expiresAt,
        deployedBy: session.user.id
      },
      include: {
        schedule: {
          select: {
            year: true,
            month: true
          }
        }
      }
    })

    // 스케줄 상태를 DEPLOYED로 변경
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: {
        status: 'DEPLOYED'
      }
    })

    return successResponse(
      {
        id: deployment.id,
        scheduleId: deployment.scheduleId,
        year: deployment.schedule.year,
        month: deployment.schedule.month,
        publicToken: deployment.publicToken,
        publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/schedule-view/${deployment.publicToken}`,
        deployedAt: deployment.deployedAt.toISOString(),
        expiresAt: deployment.expiresAt?.toISOString() || null
      },
      'Schedule deployed successfully'
    )
  } catch (error) {
    console.error('Deploy schedule error:', error)
    return errorResponse('Failed to deploy schedule', 500)
  }
}
