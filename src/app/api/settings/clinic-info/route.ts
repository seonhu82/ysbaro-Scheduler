import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/utils/api-response'

// GET: 병원 정보 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: {
        name: true,
        address: true,
        phone: true,
      }
    })

    if (!clinic) {
      return NextResponse.json(
        { success: false, error: 'Clinic not found' },
        { status: 404 }
      )
    }

    return successResponse(clinic)
  } catch (error) {
    console.error('Get clinic info error:', error)
    return errorResponse('Failed to get clinic info', 500)
  }
}

// PUT: 병원 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // ADMIN만 수정 가능
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, address, phone } = body

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      )
    }

    const updated = await prisma.clinic.update({
      where: { id: session.user.clinicId },
      data: {
        name,
        address: address || '',
        phone,
      },
      select: {
        name: true,
        address: true,
        phone: true,
      }
    })

    return successResponse(updated, 'Clinic info updated successfully')
  } catch (error) {
    console.error('Update clinic info error:', error)
    return errorResponse('Failed to update clinic info', 500)
  }
}
