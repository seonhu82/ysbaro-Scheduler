// 설정 조회/수정

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    // 모든 설정 조회
    const [ruleSettings, fairnessSettings, deploymentSettings, notificationSettings] =
      await Promise.all([
        prisma.ruleSettings.findUnique({ where: { clinicId } }),
        prisma.fairnessSettings.findUnique({ where: { clinicId } }),
        prisma.deploymentSettings.findUnique({ where: { clinicId } }),
        prisma.notificationSettings.findUnique({ where: { clinicId } }),
      ])

    return NextResponse.json({
      success: true,
      data: {
        ruleSettings,
        fairnessSettings,
        deploymentSettings,
        notificationSettings,
      },
    })
  } catch (error) {
    console.error('GET /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicId = session.user.clinicId

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: 'No clinic found' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { type, data } = body

    if (!type || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    let updated

    switch (type) {
      case 'rule':
        updated = await prisma.ruleSettings.upsert({
          where: { clinicId },
          update: data,
          create: { clinicId, ...data },
        })
        break

      case 'fairness':
        updated = await prisma.fairnessSettings.upsert({
          where: { clinicId },
          update: data,
          create: { clinicId, ...data },
        })
        break

      case 'deployment':
        updated = await prisma.deploymentSettings.upsert({
          where: { clinicId },
          update: data,
          create: { clinicId, ...data },
        })
        break

      case 'notification':
        updated = await prisma.notificationSettings.upsert({
          where: { clinicId },
          update: data,
          create: { clinicId, ...data },
        })
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid settings type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('PATCH /api/settings error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
