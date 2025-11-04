/**
 * Staff 테이블 형평성 점수 강제 업데이트 API
 * POST /api/fairness/update-staff
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateStaffFairnessScores } from '@/lib/services/fairness-score-update-service'

export async function POST(request: NextRequest) {
  try {
    const { clinicId, year, month } = await request.json()

    if (!clinicId || !year || !month) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    console.log(`📊 Staff 테이블 형평성 점수 업데이트: ${year}년 ${month}월`)

    await updateStaffFairnessScores(clinicId, year, month)

    console.log('✅ Staff 테이블 업데이트 완료')

    return NextResponse.json({
      success: true,
      message: 'Staff table fairness scores updated successfully'
    })
  } catch (error) {
    console.error('❌ Staff 테이블 업데이트 실패:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update staff fairness scores' },
      { status: 500 }
    )
  }
}
