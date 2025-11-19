import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/profile/update
 * 사용자 프로필 정보 업데이트
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('📝 [Profile Update] API called')

    const session = await auth()
    console.log('🔐 [Profile Update] Session:', session?.user)

    if (!session?.user?.id) {
      console.log('❌ [Profile Update] No session or user ID')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email } = body
    console.log('📥 [Profile Update] Request data:', { name, email })

    // 이메일 중복 확인 (본인 제외)
    if (email !== session.user.email) {
      console.log('📧 [Profile Update] Email changed, checking duplicates')
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: session.user.id }
        }
      })

      if (existingUser) {
        console.log('❌ [Profile Update] Email already exists')
        return NextResponse.json(
          { error: '이미 사용 중인 이메일입니다' },
          { status: 400 }
        )
      }
    }

    // 사용자 정보 업데이트
    console.log('💾 [Profile Update] Updating user:', session.user.id)
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        email
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    console.log('✅ [Profile Update] Success:', updatedUser)

    return NextResponse.json({
      success: true,
      data: updatedUser
    })
  } catch (error) {
    console.error('❌ [Profile Update] Error:', error)
    return NextResponse.json(
      { error: '프로필 업데이트 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
