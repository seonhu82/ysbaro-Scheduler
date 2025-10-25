/**
 * 출퇴근 통계 API
 * GET: 출퇴근 통계 조회
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

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    // 해당 월의 모든 출퇴근 기록
    const records = await prisma.attendanceRecord.findMany({
      where: {
        clinicId: session.user.clinicId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            rank: true
          }
        }
      },
      orderBy: {
        checkTime: 'asc'
      }
    })

    // 전체 통계
    const totalChecks = records.length
    const totalCheckIns = records.filter(r => r.checkType === 'IN').length
    const totalCheckOuts = records.filter(r => r.checkType === 'OUT').length
    const suspiciousCount = records.filter(r => r.isSuspicious).length

    // 직원별 통계
    const staffMap = new Map<string, any>()

    records.forEach(record => {
      const staffId = record.staffId

      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, {
          id: record.staff.id,
          name: record.staff.name,
          rank: record.staff.rank,
          totalChecks: 0,
          checkIns: 0,
          checkOuts: 0,
          suspicious: 0,
          days: new Set()
        })
      }

      const stats = staffMap.get(staffId)
      stats.totalChecks++
      if (record.checkType === 'IN') stats.checkIns++
      if (record.checkType === 'OUT') stats.checkOuts++
      if (record.isSuspicious) stats.suspicious++
      stats.days.add(record.date.toISOString().split('T')[0])
    })

    // 직원별 통계를 배열로 변환
    const byStaff = Array.from(staffMap.values()).map(stats => ({
      id: stats.id,
      name: stats.name,
      rank: stats.rank,
      totalChecks: stats.totalChecks,
      checkIns: stats.checkIns,
      checkOuts: stats.checkOuts,
      suspicious: stats.suspicious,
      workDays: stats.days.size
    })).sort((a, b) => b.totalChecks - a.totalChecks)

    // 일별 통계 (차트용)
    const dailyMap = new Map<string, { date: string; checkIns: number; checkOuts: number; suspicious: number }>()

    records.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0]

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: dateKey,
          checkIns: 0,
          checkOuts: 0,
          suspicious: 0
        })
      }

      const daily = dailyMap.get(dateKey)!
      if (record.checkType === 'IN') daily.checkIns++
      if (record.checkType === 'OUT') daily.checkOuts++
      if (record.isSuspicious) daily.suspicious++
    })

    const dailyStats = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )

    return successResponse({
      period: {
        year,
        month,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      summary: {
        totalChecks,
        totalCheckIns,
        totalCheckOuts,
        suspiciousCount
      },
      byStaff,
      dailyStats
    })
  } catch (error) {
    console.error('Get attendance statistics error:', error)
    return errorResponse('Failed to fetch statistics', 500)
  }
}
