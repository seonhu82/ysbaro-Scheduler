/**
 * 부서장 수동 배치 링크 생성 API
 * POST: 부서장이 사용할 수동 배치 링크 생성
 * GET: 생성된 링크 목록 조회
 */

import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const departmentName = searchParams.get('departmentName')
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const where: any = {
      clinicId: session.user.clinicId
    }

    if (departmentName) {
      where.departmentName = departmentName
    }
    if (year) {
      where.year = parseInt(year)
    }
    if (month) {
      where.month = parseInt(month)
    }

    // 생성된 링크 목록 조회
    const links = await prisma.manualAssignLink.findMany({
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

    const linkList = links.map(link => ({
      id: link.id,
      clinicId: link.clinicId,
      clinicName: link.clinic.name,
      departmentName: link.departmentName,
      year: link.year,
      month: link.month,
      publicToken: link.token,
      publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/manual-assign/${link.token}`,
      createdAt: link.createdAt.toISOString(),
      expiresAt: link.expiresAt.toISOString(),
      isActive: link.expiresAt > new Date()
    }))

    return successResponse(linkList)
  } catch (error) {
    console.error('Get manual assign links error:', error)
    return errorResponse('Failed to fetch manual assign links', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // ADMIN 권한 확인
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return errorResponse('Insufficient permissions', 403)
    }

    const body = await request.json()
    const { departmentName, expiryDays = 365 } = body

    if (!departmentName) {
      return badRequestResponse('Department name is required')
    }

    // 부서 확인
    const department = await prisma.department.findFirst({
      where: {
        clinicId: session.user.clinicId,
        name: departmentName
      }
    })

    if (!department) {
      return errorResponse('Department not found', 404)
    }

    if (department.useAutoAssignment) {
      return errorResponse('This department uses auto-assignment. Manual assign links are not applicable.', 400)
    }

    // 현재 년월 가져오기
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    // 공개 토큰 생성
    const publicToken = randomBytes(16).toString('hex')

    // 만료일 계산
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 기본 365일

    // 링크 생성
    const link = await prisma.manualAssignLink.create({
      data: {
        clinicId: session.user.clinicId,
        departmentName,
        year,
        month,
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
        id: link.id,
        clinicId: link.clinicId,
        clinicName: link.clinic.name,
        departmentName: link.departmentName,
        year: link.year,
        month: link.month,
        publicToken: link.token,
        publicUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/manual-assign/${link.token}`,
        createdAt: link.createdAt.toISOString(),
        expiresAt: link.expiresAt.toISOString()
      },
      'Manual assign link created successfully'
    )
  } catch (error) {
    console.error('Create manual assign link error:', error)
    return errorResponse('Failed to create manual assign link', 500)
  }
}
