/**
 * 백업 관리 API
 * GET: 백업 목록 조회
 * POST: 새 백업 생성
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

    // BackupConfig 조회 (실제 백업 파일 목록)
    const backups = await prisma.backupConfig.findMany({
      where: {
        clinicId: session.user.clinicId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // 최근 50개
    })

    // 백업 정보를 UI에 맞게 변환
    const backupList = backups.map(backup => ({
      id: backup.id,
      filename: `backup_${backup.createdAt.toISOString().split('T')[0]}_${backup.id.slice(0, 8)}.json`,
      size: 0, // 파일 크기는 실제 구현 시 저장
      createdAt: backup.createdAt.toISOString()
    }))

    return successResponse(backupList)
  } catch (error) {
    console.error('Get backups error:', error)
    return errorResponse('Failed to fetch backups', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    // 백업 설정 및 데이터 수집
    const backup = await prisma.backupConfig.create({
      data: {
        clinicId: session.user.clinicId,
        autoBackup: false,
        backupFrequency: 'MANUAL',
        retentionDays: 30
      }
    })

    // 실제 백업 데이터는 클라이언트 측에서 JSON으로 다운로드
    // 서버에서는 백업 기록만 관리

    return successResponse(
      {
        id: backup.id,
        filename: `backup_${new Date().toISOString().split('T')[0]}_${backup.id.slice(0, 8)}.json`,
        size: 0,
        createdAt: backup.createdAt.toISOString()
      },
      'Backup created successfully'
    )
  } catch (error) {
    console.error('Create backup error:', error)
    return errorResponse('Failed to create backup', 500)
  }
}
