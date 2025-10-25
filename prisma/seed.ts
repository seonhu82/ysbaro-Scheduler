import { PrismaClient, UserRole, StaffRank, DayType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // 1. 클리닉 생성
  console.log('📍 Creating clinic...')
  const clinic = await prisma.clinic.upsert({
    where: { id: 'clinic-1' },
    update: {},
    create: {
      id: 'clinic-1',
      name: '연세바로치과',
      address: '서울시 강남구 테헤란로 123',
      phone: '02-1234-5678',
    },
  })
  console.log(`✅ Clinic created: ${clinic.name}`)

  // 2. 관리자 계정 생성
  console.log('👤 Creating admin user...')
  const hashedPassword = await bcrypt.hash('admin123!', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@dental.com' },
    update: {},
    create: {
      email: 'admin@dental.com',
      password: hashedPassword,
      name: '관리자',
      role: UserRole.ADMIN,
      clinicId: clinic.id,
    },
  })
  console.log(`✅ Admin user created: ${adminUser.email}`)

  // 3. 원장 5명 생성
  console.log('⚕️  Creating doctors...')
  const doctors = await Promise.all([
    prisma.doctor.upsert({
      where: { id: 'doctor-1' },
      update: {},
      create: {
        id: 'doctor-1',
        clinicId: clinic.id,
        name: '김원장',
        specialization: '일반진료',
        isActive: true,
      },
    }),
    prisma.doctor.upsert({
      where: { id: 'doctor-2' },
      update: {},
      create: {
        id: 'doctor-2',
        clinicId: clinic.id,
        name: '이원장',
        specialization: '임플란트',
        isActive: true,
      },
    }),
    prisma.doctor.upsert({
      where: { id: 'doctor-3' },
      update: {},
      create: {
        id: 'doctor-3',
        clinicId: clinic.id,
        name: '박원장',
        specialization: '교정',
        isActive: true,
      },
    }),
    prisma.doctor.upsert({
      where: { id: 'doctor-4' },
      update: {},
      create: {
        id: 'doctor-4',
        clinicId: clinic.id,
        name: '최원장',
        specialization: '보존',
        isActive: true,
      },
    }),
    prisma.doctor.upsert({
      where: { id: 'doctor-5' },
      update: {},
      create: {
        id: 'doctor-5',
        clinicId: clinic.id,
        name: '정원장',
        specialization: '보철',
        isActive: true,
      },
    }),
  ])
  console.log(`✅ Created ${doctors.length} doctors`)

  // 4. 원장별 기본 패턴 생성 (월~토 근무, 일 휴무)
  console.log('📅 Creating doctor patterns...')
  for (const doctor of doctors) {
    const pattern = await prisma.doctorPattern.upsert({
      where: { id: `pattern-${doctor.id}` },
      update: {},
      create: {
        id: `pattern-${doctor.id}`,
        doctorId: doctor.id,
        patternName: '기본 패턴',
        isActive: true,
      },
    })

    // 요일별 패턴 (0=일, 1=월, ..., 6=토)
    for (let day = 0; day <= 6; day++) {
      await prisma.doctorPatternDay.upsert({
        where: {
          patternId_dayOfWeek: {
            patternId: pattern.id,
            dayOfWeek: day,
          },
        },
        update: {},
        create: {
          patternId: pattern.id,
          dayOfWeek: day,
          isWorkday: day !== 0, // 일요일 제외
          hasNightShift: day === 5, // 토요일 야간진료
        },
      })
    }
  }
  console.log('✅ Doctor patterns created')

  // 5. 직원 20명 생성 (다양한 직급)
  console.log('👥 Creating staff members...')
  const staffMembers = await Promise.all([
    // 위생사 (8명)
    ...Array.from({ length: 8 }, (_, i) =>
      prisma.staff.upsert({
        where: { id: `staff-hygienist-${i + 1}` },
        update: {},
        create: {
          id: `staff-hygienist-${i + 1}`,
          clinicId: clinic.id,
          name: `위생사${i + 1}`,
          birthDate: new Date(1995 + i, 0, 1),
          birthDateStr: '950101',
          departmentName: '진료실',
          categoryName: '중간년차',
          workType: 'WEEK_5',
          workDays: 5,
          rank: StaffRank.HYGIENIST,
          pin: String(1000 + i).padStart(4, '0'),
          phoneNumber: `010-1000-${String(i).padStart(4, '0')}`,
          email: `hygienist${i + 1}@dental.com`,
          isActive: true,
        },
      })
    ),
    // 어시스턴트 (6명)
    ...Array.from({ length: 6 }, (_, i) =>
      prisma.staff.upsert({
        where: { id: `staff-assistant-${i + 1}` },
        update: {},
        create: {
          id: `staff-assistant-${i + 1}`,
          clinicId: clinic.id,
          name: `어시${i + 1}`,
          birthDate: new Date(1996 + i, 0, 1),
          birthDateStr: '960101',
          departmentName: '진료실',
          categoryName: '저년차',
          workType: 'WEEK_5',
          workDays: 5,
          rank: StaffRank.ASSISTANT,
          pin: String(2000 + i).padStart(4, '0'),
          phoneNumber: `010-2000-${String(i).padStart(4, '0')}`,
          email: `assistant${i + 1}@dental.com`,
          isActive: true,
        },
      })
    ),
    // 코디네이터 (3명)
    ...Array.from({ length: 3 }, (_, i) =>
      prisma.staff.upsert({
        where: { id: `staff-coordinator-${i + 1}` },
        update: {},
        create: {
          id: `staff-coordinator-${i + 1}`,
          clinicId: clinic.id,
          name: `코디${i + 1}`,
          birthDate: new Date(1994 + i, 0, 1),
          birthDateStr: '940101',
          departmentName: '데스크',
          categoryName: '중간년차',
          workType: 'WEEK_5',
          workDays: 5,
          rank: StaffRank.COORDINATOR,
          pin: String(3000 + i).padStart(4, '0'),
          phoneNumber: `010-3000-${String(i).padStart(4, '0')}`,
          email: `coordinator${i + 1}@dental.com`,
          isActive: true,
        },
      })
    ),
    // 간호조무사 (3명)
    ...Array.from({ length: 3 }, (_, i) =>
      prisma.staff.upsert({
        where: { id: `staff-nurse-${i + 1}` },
        update: {},
        create: {
          id: `staff-nurse-${i + 1}`,
          clinicId: clinic.id,
          name: `간호${i + 1}`,
          birthDate: new Date(1997 + i, 0, 1),
          birthDateStr: '970101',
          departmentName: '진료실',
          categoryName: '저년차',
          workType: 'WEEK_5',
          workDays: 5,
          rank: StaffRank.NURSE,
          pin: String(4000 + i).padStart(4, '0'),
          phoneNumber: `010-4000-${String(i).padStart(4, '0')}`,
          email: `nurse${i + 1}@dental.com`,
          isActive: true,
        },
      })
    ),
  ])
  console.log(`✅ Created ${staffMembers.length} staff members`)

  // 6. 직급별 설정
  console.log('⚙️  Creating staff rank settings...')
  await Promise.all([
    prisma.staffRankSettings.upsert({
      where: { rank: StaffRank.HYGIENIST },
      update: {},
      create: {
        rank: StaffRank.HYGIENIST,
        requiredCount: 4,
        distributionRate: 0.4,
      },
    }),
    prisma.staffRankSettings.upsert({
      where: { rank: StaffRank.ASSISTANT },
      update: {},
      create: {
        rank: StaffRank.ASSISTANT,
        requiredCount: 3,
        distributionRate: 0.3,
      },
    }),
    prisma.staffRankSettings.upsert({
      where: { rank: StaffRank.COORDINATOR },
      update: {},
      create: {
        rank: StaffRank.COORDINATOR,
        requiredCount: 2,
        distributionRate: 0.2,
      },
    }),
    prisma.staffRankSettings.upsert({
      where: { rank: StaffRank.NURSE },
      update: {},
      create: {
        rank: StaffRank.NURSE,
        requiredCount: 1,
        distributionRate: 0.1,
      },
    }),
  ])
  console.log('✅ Staff rank settings created')

  // 7. 2025년 공휴일 등록
  console.log('🎉 Creating holidays...')
  const holidays2025 = [
    { date: new Date('2025-01-01'), name: '신정' },
    { date: new Date('2025-01-28'), name: '설날연휴' },
    { date: new Date('2025-01-29'), name: '설날' },
    { date: new Date('2025-01-30'), name: '설날연휴' },
    { date: new Date('2025-03-01'), name: '3.1절' },
    { date: new Date('2025-03-03'), name: '개교기념일' },
    { date: new Date('2025-05-05'), name: '어린이날' },
    { date: new Date('2025-05-06'), name: '대체공휴일' },
    { date: new Date('2025-06-06'), name: '현충일' },
    { date: new Date('2025-08-15'), name: '광복절' },
    { date: new Date('2025-10-03'), name: '개천절' },
    { date: new Date('2025-10-06'), name: '추석연휴' },
    { date: new Date('2025-10-07'), name: '추석' },
    { date: new Date('2025-10-08'), name: '추석연휴' },
    { date: new Date('2025-10-09'), name: '한글날' },
    { date: new Date('2025-12-25'), name: '크리스마스' },
  ]

  for (const holiday of holidays2025) {
    await prisma.holiday.upsert({
      where: {
        clinicId_date: {
          clinicId: clinic.id,
          date: holiday.date,
        },
      },
      update: {},
      create: {
        clinicId: clinic.id,
        date: holiday.date,
        name: holiday.name,
      },
    })
  }
  console.log(`✅ Created ${holidays2025.length} holidays`)

  // 8. 기본 설정
  console.log('⚙️  Creating default settings...')

  await prisma.ruleSettings.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      weekBusinessDays: 6,
      defaultWorkDays: 4,
      maxWeeklyOffs: 2,
      preventSundayOff: true,
      preventHolidayOff: true,
      maxConsecutiveNights: 3,
      minRestAfterNight: 1,
    },
  })

  await prisma.fairnessSettings.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      enableNightShiftFairness: true,
        enableWeekendFairness: true,
        enableHolidayFairness: true,
        enableHolidayAdjacentFairness: false,
            fairnessThreshold: 0.2,
    },
  })

  await prisma.deploymentSettings.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      autoGenerateLink: true,
      linkValidityDays: 30,
      allowIndividualView: true,
      allowFullView: true,
      allowDoctorView: true,
    },
  })

  await prisma.notificationSettings.upsert({
    where: { clinicId: clinic.id },
    update: {},
    create: {
      clinicId: clinic.id,
      enableBrowserNotification: true,
      enableEmailNotification: false,
      notifyOnLeaveSubmit: true,
      notifyOnLeaveConfirm: true,
      notifyOnScheduleDeploy: true,
    },
  })

  await prisma.backupConfig.upsert({
    where: { id: 'backup-config-1' },
    update: {},
    create: {
      id: 'backup-config-1',
      clinicId: clinic.id,
      enableAutoBackup: true,
      backupFrequency: 'daily',
      retentionDays: 30
    },
  })

  console.log('✅ Default settings created')

  console.log('🎊 Seed completed successfully!')
  console.log('\n📋 Summary:')
  console.log(`  - Clinic: ${clinic.name}`)
  console.log(`  - Admin: ${adminUser.email} (password: admin123!)`)
  console.log(`  - Doctors: ${doctors.length}명`)
  console.log(`  - Staff: ${staffMembers.length}명`)
  console.log(`  - Holidays: ${holidays2025.length}개`)
  console.log('\n🚀 Ready to start development!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
