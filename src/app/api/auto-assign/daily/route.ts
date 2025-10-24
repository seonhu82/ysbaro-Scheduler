// 일별 배치
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { autoAssignSingleSlot } from '@/lib/algorithms/auto-assign'

export async function GET(request: NextRequest) {
  try {
    // TODO: 일별 배치 목록 조회 구현
    return NextResponse.json({ success: true, data: [] })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { slotId } = await request.json()

    if (!slotId) {
      return NextResponse.json(
        { success: false, error: 'slotId is required' },
        { status: 400 }
      )
    }

    const result = await autoAssignSingleSlot(slotId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
