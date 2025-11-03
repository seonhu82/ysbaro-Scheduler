/**
 * 직원 배치 검증 API
 * POST: 원장-직원 조합에 따른 필수 인원 및 카테고리별 인원 검증
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { doctors, staff, date } = body

    if (!doctors || !staff) {
      return badRequestResponse('doctors and staff are required')
    }

    const clinicId = session.user.clinicId
    const warnings: string[] = []

    console.log('🔍 필수 인원 검증 시작:', {
      clinicId,
      doctors: doctors?.map((d: any) => d.name),
      staff: staff?.map((s: any) => `${s.name}(${s.categoryName})`),
      staffCount: staff?.length
    })

    // 1. 원장-직원 조합 확인
    if (doctors && doctors.length > 0) {
      const doctorCombination = await prisma.doctorCombination.findFirst({
        where: {
          clinicId,
          doctors: {
            hasSome: doctors.map((d: any) => d.id)
          }
        }
      })

      console.log('👨‍⚕️ DoctorCombination 조회:', doctorCombination ? '찾음' : '없음')

      if (doctorCombination) {
        console.log('📋 필수 인원 설정:', {
          requiredStaff: doctorCombination.requiredStaff,
          departmentCategoryStaff: doctorCombination.departmentCategoryStaff
        })
        const requiredStaff = doctorCombination.requiredStaff
        const actualStaff = staff?.length || 0

        // 1-1. 필수 인원 체크
        console.log('👥 총 인원 체크:', {
          required: requiredStaff,
          actual: actualStaff,
          shortage: requiredStaff - actualStaff
        })

        if (actualStaff < requiredStaff) {
          const warning = `⚠️ 필수 인원 미달: 필요 ${requiredStaff}명, 현재 ${actualStaff}명 (${requiredStaff - actualStaff}명 부족)`
          warnings.push(warning)
          console.log('⚠️ 총 인원 경고:', warning)
        }

        // 1-2. 카테고리별 필수 인원 체크
        if (doctorCombination.departmentCategoryStaff) {
          const categoryStaff = doctorCombination.departmentCategoryStaff as any
          const requiredCategories = categoryStaff['진료실'] || {}

          // 실제 배치된 카테고리별 인원 계산
          const actualCategories: any = {}
          for (const s of staff || []) {
            const cat = s.categoryName || '미분류'
            actualCategories[cat] = (actualCategories[cat] || 0) + 1
          }

          console.log('📊 카테고리 검증:', {
            required: requiredCategories,
            actual: actualCategories
          })

          // 카테고리별 체크
          for (const [category, required] of Object.entries(requiredCategories)) {
            const actual = actualCategories[category] || 0
            const reqData = required as any

            // count: 권장 인원, minRequired: 최소 필수 인원
            const minRequired = reqData.minRequired || 0
            const recommendedCount = reqData.count || 0

            console.log(`📊 ${category} 체크:`, {
              actual,
              minRequired,
              recommendedCount
            })

            // 최소 필수 인원 체크 (경고)
            if (actual < minRequired) {
              const warning = `⚠️ ${category} 최소 인원 미달: 최소 ${minRequired}명 필요, 현재 ${actual}명`
              warnings.push(warning)
              console.log('⚠️ 카테고리 경고:', warning)
            }
            // 권장 인원 체크 (정보성)
            else if (actual < recommendedCount) {
              const warning = `ℹ️ ${category} 권장 인원 부족: 권장 ${recommendedCount}명, 현재 ${actual}명`
              warnings.push(warning)
              console.log('ℹ️ 카테고리 정보:', warning)
            }
          }
        }
      }
    }

    console.log('✅ 검증 완료:', {
      warningCount: warnings.length,
      warnings
    })

    return successResponse({
      warnings,
      isValid: warnings.length === 0
    })

  } catch (error) {
    console.error('Validate staff count error:', error)
    return errorResponse('Failed to validate staff count', 500)
  }
}
