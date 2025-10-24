import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinicId = session.user.clinicId
    if (!clinicId) {
      return NextResponse.json({ error: 'Clinic ID not found' }, { status: 400 })
    }

    const data = await request.json()
    const { clinicInfo, departments, categories, doctors, staff, combinations, closedDays, fairness, categoryRatios } = data

    // 트랜잭션으로 모든 데이터 저장
    await prisma.$transaction(async (tx) => {
      // 1. 병원 정보 업데이트
      await tx.clinic.update({
        where: { id: clinicId },
        data: {
          name: clinicInfo.name,
          address: clinicInfo.address,
          phone: clinicInfo.phone,
          setupCompleted: true,
        },
      })

      // 2. 부서 생성
      for (const dept of departments) {
        await tx.department.create({
          data: {
            clinicId: clinicId,
            name: dept.name,
            order: dept.order,
          },
        })
      }

      // 3. 구분 생성
      for (const cat of categories) {
        await tx.staffCategory.create({
          data: {
            clinicId: clinicId,
            name: cat.name,
            priority: cat.priority,
            order: cat.order,
          },
        })
      }

      // 4. 원장 생성
      for (const doctor of doctors) {
        const createdDoctor = await tx.doctor.create({
          data: {
            clinicId: clinicId,
            name: doctor.name,
            shortName: doctor.shortName || doctor.name.charAt(0),
            useCategory: doctor.useCategory,
            isActive: true,
          },
        })

        // 원장 구분 생성
        if (doctor.useCategory && doctor.categories.length > 0) {
          for (const category of doctor.categories) {
            await tx.doctorCategory.create({
              data: {
                clinicId: clinicId,
                doctorId: createdDoctor.id,
                name: category.name,
                shortName: category.shortName || `${doctor.shortName}(${category.name})`,
              },
            })
          }
        }
      }

      // 5. 직원 생성
      for (const staffMember of staff) {
        // birthDate를 DateTime으로 변환 (YYMMDD -> Date)
        const year = parseInt('20' + staffMember.birthDate.substring(0, 2))
        const month = parseInt(staffMember.birthDate.substring(2, 4))
        const day = parseInt(staffMember.birthDate.substring(4, 6))
        const birthDate = new Date(year, month - 1, day)

        await tx.staff.create({
          data: {
            clinicId: clinicId,
            name: staffMember.name,
            birthDate: birthDate,
            birthDateStr: staffMember.birthDate,
            departmentName: staffMember.departmentName,
            categoryName: staffMember.categoryName,
            position: staffMember.position || '사원',
            workType: staffMember.workType,
            workDays: staffMember.workType === 'WEEK_4' ? 4 : 5,
            pin: staffMember.birthDate,
            flexibleForCategories: staffMember.flexibleForCategories || [],
            flexibilityPriority: staffMember.flexibilityPriority || 0,
            isActive: true,
          },
        })
      }

      // 6. 의사 조합 생성
      for (const combination of combinations) {
        await tx.doctorCombination.create({
          data: {
            clinicId: clinicId,
            name: combination.name,
            dayOfWeek: combination.dayOfWeek,
            requiredStaff: combination.requiredStaff,
            doctors: combination.doctors,
            hasNightShift: combination.hasNightShift || false,
          },
        })
      }

      // 6.5 구분별 비율 설정 생성
      if (categoryRatios) {
        await tx.categoryRatioSettings.create({
          data: {
            clinicId: clinicId,
            ratios: categoryRatios,
          },
        })
      }

      // 7. 휴업일 설정
      await tx.closedDaySettings.create({
        data: {
          clinicId: clinicId,
          includeHolidays: closedDays.includeHolidays,
          years: closedDays.years || [],
          regularDays: closedDays.regularDays || [],
          specificDates: closedDays.specificDates || [],
        },
      })

      // 8. 형평성 설정 업데이트
      await tx.fairnessSettings.upsert({
        where: { clinicId: clinicId },
        update: {
          enableNightShiftFairness: fairness.enableNightShiftFairness ?? true,
          enableWeekendFairness: fairness.enableWeekendFairness ?? true,
          enableHolidayFairness: fairness.enableHolidayFairness ?? true,
          enableHolidayAdjacentFairness: fairness.enableHolidayAdjacentFairness ?? false,
          fairnessThreshold: 0.2,
        },
        create: {
          clinicId: clinicId,
          enableNightShiftFairness: fairness.enableNightShiftFairness ?? true,
          enableWeekendFairness: fairness.enableWeekendFairness ?? true,
          enableHolidayFairness: fairness.enableHolidayFairness ?? true,
          enableHolidayAdjacentFairness: fairness.enableHolidayAdjacentFairness ?? false,
          fairnessThreshold: 0.2,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Initial setup error:', error)
    return NextResponse.json(
      { error: 'Failed to save setup data' },
      { status: 500 }
    )
  }
}

// 설정 완료 여부 확인
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.clinicId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clinic = await prisma.clinic.findUnique({
      where: { id: session.user.clinicId },
      select: { setupCompleted: true },
    })

    return NextResponse.json({ setupCompleted: clinic?.setupCompleted || false })
  } catch (error) {
    console.error('Get setup status error:', error)
    return NextResponse.json(
      { error: 'Failed to get setup status' },
      { status: 500 }
    )
  }
}
