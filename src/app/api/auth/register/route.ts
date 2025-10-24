import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { clinicName, name, email, password } = await request.json()

    // 유효성 검사
    if (!clinicName || !name || !email || !password) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = await bcrypt.hash(password, 10)

    // 트랜잭션으로 Clinic과 User 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. Clinic 생성
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          setupCompleted: false,
        },
      })

      // 2. 관리자 User 생성
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'ADMIN',
          clinicId: clinic.id,
        },
      })

      // 3. 기본 설정 생성 (선택적)
      await tx.ruleSettings.create({
        data: {
          clinicId: clinic.id,
          weekBusinessDays: 6,
          defaultWorkDays: 4,
          staffCategories: ['팀장/실장', '고년차', '중간년차', '저년차'],
          maxWeeklyOffs: 2,
          preventSundayOff: true,
          preventHolidayOff: true,
          maxConsecutiveNights: 3,
          minRestAfterNight: 1,
        },
      })

      await tx.fairnessSettings.create({
        data: {
          clinicId: clinic.id,
          nightShiftWeight: 2.0,
          weekendWeight: 1.5,
          holidayWeight: 2.0,
          enableFairnessCheck: false,
          fairnessThreshold: 0.2,
        },
      })

      await tx.deploymentSettings.create({
        data: {
          clinicId: clinic.id,
          autoGenerateLink: true,
          linkValidityDays: 30,
          allowIndividualView: true,
          allowFullView: true,
          allowDoctorView: true,
        },
      })

      await tx.notificationSettings.create({
        data: {
          clinicId: clinic.id,
          enableBrowserNotification: true,
          enableEmailNotification: false,
          notifyOnLeaveSubmit: true,
          notifyOnLeaveConfirm: true,
          notifyOnScheduleDeploy: true,
        },
      })

      return { clinic, user }
    })

    return NextResponse.json({
      success: true,
      message: '계정이 생성되었습니다',
      clinicId: result.clinic.id,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '계정 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
