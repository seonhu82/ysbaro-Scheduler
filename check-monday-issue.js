/**
 * 월요일 팀장실장급 부족 문제 확인
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const clinicId = 'cmh697itv0001fw83azbrqe60';

async function checkMondayIssue() {
  console.log('='.repeat(80));
  console.log('월요일 팀장실장급 문제 분석');
  console.log('='.repeat(80));

  // 11월 월요일들
  const mondays = [
    new Date('2025-11-03'),
    new Date('2025-11-10'),
    new Date('2025-11-17'),
    new Date('2025-11-24'),
  ];

  for (const monday of mondays) {
    const dateStr = monday.toISOString().split('T')[0];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 ${dateStr} (월요일)`);
    console.log('-'.repeat(80));

    // 1. 스케줄 확인
    const schedule = await prisma.schedule.findFirst({
      where: {
        clinicId,
        date: monday,
      },
      select: {
        scheduleDoctors: { select: { doctor: { select: { name: true } } } },
        doctorCombination: {
          select: {
            doctors: true,
            requiredStaff: true,
          }
        }
      }
    });

    if (!schedule) {
      console.log('❌ 스케줄 없음');
      continue;
    }

    console.log('출근 의사:', schedule.doctors);
    console.log('의사 조합:', schedule.doctorCombination?.doctors);
    console.log('필수 인원:', JSON.stringify(schedule.doctorCombination?.requiredStaff, null, 2));

    // 2. 팀장실장급 직원 확인
    const directorStaff = await prisma.staff.findMany({
      where: {
        clinicId,
        isActive: true,
        categoryName: '팀장실장급',
      },
      select: {
        id: true,
        name: true,
        categoryName: true,
      }
    });

    console.log(`\n팀장실장급 직원 (총 ${directorStaff.length}명):`);
    directorStaff.forEach(s => {
      console.log(`  - ${s.name} (${s.id})`);
    });

    // 3. 해당 날짜 신청 현황
    const applications = await prisma.leaveApplication.findMany({
      where: {
        clinicId,
        date: monday,
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        staff: {
          categoryName: '팀장실장급'
        }
      },
      select: {
        staff: {
          select: {
            name: true,
            categoryName: true,
          }
        },
        leaveType: true,
        status: true,
      }
    });

    console.log(`\n팀장실장급 신청 현황 (${applications.length}건):`);
    if (applications.length === 0) {
      console.log('  없음');
    } else {
      applications.forEach(app => {
        console.log(`  - ${app.staff.name}: ${app.leaveType} (${app.status})`);
      });
    }

    // 4. 필수 인원 계산
    const requiredStaff = schedule.doctorCombination?.requiredStaff || {};
    const directorRequired = requiredStaff['팀장실장급'] || 0;
    const directorAvailable = directorStaff.length - applications.length;

    console.log(`\n📊 팀장실장급 슬롯:`);
    console.log(`  필요: ${directorRequired}명`);
    console.log(`  전체: ${directorStaff.length}명`);
    console.log(`  신청: ${applications.length}명`);
    console.log(`  가능: ${directorAvailable}명`);

    if (directorRequired === 0) {
      console.log(`\n✅ 팀장실장급 필요 없음 (required = 0)`);
    } else if (directorAvailable >= directorRequired) {
      console.log(`\n✅ 충분함 (${directorAvailable} >= ${directorRequired})`);
    } else {
      console.log(`\n❌ 부족함 (${directorAvailable} < ${directorRequired})`);
    }
  }

  await prisma.$disconnect();
}

checkMondayIssue().catch(console.error);
