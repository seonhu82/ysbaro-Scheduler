import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const {
      clinicType, // 'existing' or 'new'
      clinicId, // for existing clinic
      clinicName, // for new clinic
      name,
      email,
      password,
      applicationReason, // optional
    } = await request.json()

    // 유효성 검사
    if (!name || !email || !password || !clinicType) {
      return NextResponse.json(
        { error: '필수 필드를 모두 입력해주세요' },
        { status: 400 }
      )
    }

    if (clinicType === 'existing' && !clinicId) {
      return NextResponse.json(
        { error: '병원을 선택해주세요' },
        { status: 400 }
      )
    }

    if (clinicType === 'new' && !clinicName) {
      return NextResponse.json(
        { error: '병원명을 입력해주세요' },
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

    // 트랜잭션으로 처리
    const result = await prisma.$transaction(async (tx) => {
      let targetClinicId = clinicId

      // 새 병원 생성 시
      if (clinicType === 'new') {
        const newClinic = await tx.clinic.create({
          data: {
            name: clinicName,
            setupCompleted: false,
          },
        })
        targetClinicId = newClinic.id

        // 기본 설정 생성
        await Promise.all([
          tx.ruleSettings.create({
            data: {
              clinicId: newClinic.id,
              weekBusinessDays: 6,
              defaultWorkDays: 4,
              staffCategories: ['팀장/실장', '고년차', '중간년차', '저년차'],
              maxWeeklyOffs: 2,
              preventSundayOff: true,
              preventHolidayOff: true,
              maxConsecutiveNights: 3,
              minRestAfterNight: 1,
            },
          }),
          tx.fairnessSettings.create({
            data: {
              clinicId: newClinic.id,
              enableNightShiftFairness: true,
              enableWeekendFairness: true,
              enableHolidayFairness: true,
              enableHolidayAdjacentFairness: false,
              fairnessThreshold: 0.2,
            },
          }),
          tx.deploymentSettings.create({
            data: {
              clinicId: newClinic.id,
              autoGenerateLink: true,
              linkValidityDays: 30,
              allowIndividualView: true,
              allowFullView: true,
              allowDoctorView: true,
            },
          }),
          tx.notificationSettings.create({
            data: {
              clinicId: newClinic.id,
              enableBrowserNotification: true,
              enableEmailNotification: false,
              notifyOnLeaveSubmit: true,
              notifyOnLeaveConfirm: true,
              notifyOnScheduleDeploy: true,
            },
          }),
        ])
      }

      // 사용자 생성 (PENDING 상태)
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'STAFF', // 기본 역할은 STAFF, 승인 시 변경 가능
          accountStatus: 'PENDING', // 승인 대기 상태
          clinicId: targetClinicId,
        },
      })

      // 관리자에게 알림 생성
      const admins = await tx.user.findMany({
        where: {
          AND: [
            { clinicId: targetClinicId },
            {
              OR: [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN' }],
            },
            { accountStatus: 'APPROVED' },
          ],
        },
      })

      // 각 관리자에게 알림 전송
      if (admins.length > 0) {
        await Promise.all(
          admins.map((admin) =>
            tx.notification.create({
              data: {
                clinicId: targetClinicId!,
                userId: admin.id,
                type: 'USER_REGISTRATION',
                title: '새로운 회원가입 신청',
                message: `${name}(${email})님이 회원가입을 신청했습니다.${
                  applicationReason ? `\n사유: ${applicationReason}` : ''
                }`,
                isRead: false,
              },
            })
          )
        )
      }

      // 활동 로그 기록
      await tx.activityLog.create({
        data: {
          clinicId: targetClinicId!,
          userId: user.id,
          activityType: 'USER_REGISTERED',
          description: `새로운 사용자 등록: ${name} (${email})`,
          metadata: {
            clinicType,
            applicationReason,
          },
        },
      })

      return { user, clinicId: targetClinicId }
    })

    return NextResponse.json({
      success: true,
      message: '가입 신청이 완료되었습니다. 관리자의 승인을 기다려주세요.',
      userId: result.user.id,
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '계정 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
