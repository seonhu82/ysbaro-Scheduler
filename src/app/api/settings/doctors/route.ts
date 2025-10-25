/**
 * 원장 목록 조회 API
 * GET: 원장 목록
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

    const doctors = await prisma.doctor.findMany({
      where: {
        clinicId: session.user.clinicId
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        specialization: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return successResponse(doctors)
  } catch (error) {
    console.error('Get doctors error:', error)
    return errorResponse('Failed to fetch doctors', 500)
  }
}
