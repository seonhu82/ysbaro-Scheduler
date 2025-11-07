/**
 * 직급 삭제 API
 * DELETE: 해당 직급을 사용하는 직원이 없으면 삭제 (실제로는 Staff 업데이트)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE: 직급 삭제 (해당 직급 사용 중인 직원들의 position을 null로 변경)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = session.user.clinicId
    const positionName = decodeURIComponent(params.name)

    // 해당 직급을 사용하는 직원 수 확인
    const staffCount = await prisma.staff.count({
      where: {
        clinicId,
        position: positionName
      }
    })

    if (staffCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `${staffCount}명의 직원이 이 직급을 사용 중입니다. 먼저 해당 직원들의 직급을 변경해주세요.`
        },
        { status: 400 }
      )
    }

    // 사용 중인 직원이 없으면 삭제 성공 (실제로는 이미 데이터가 없음)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete position:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete position' }, { status: 500 })
  }
}
