const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const clinicId = 'cmh697itv0001fw83azbrqe60';

  console.log('📊 팀장실장급 직원 현황\n');

  const staff = await prisma.staff.findMany({
    where: {
      clinicId,
      categoryName: '팀장실장급',
    },
    select: {
      name: true,
      isActive: true,
      categoryName: true,
    },
    orderBy: { name: 'asc' }
  });

  const active = staff.filter(s => s.isActive);
  const inactive = staff.filter(s => !s.isActive);

  console.log(`전체: ${staff.length}명`);
  console.log(`활성: ${active.length}명`);
  console.log(`비활성: ${inactive.length}명\n`);

  console.log('활성 직원:');
  active.forEach(s => console.log(`  ✅ ${s.name}`));

  if (inactive.length > 0) {
    console.log('\n비활성 직원:');
    inactive.forEach(s => console.log(`  ❌ ${s.name}`));
  }

  console.log('\n\n📅 11월 24일 필수 인원 확인');

  // WeekInfo를 통해 DailySlot 찾기
  const weekInfo = await prisma.weekInfo.findFirst({
    where: {
      schedule: { clinicId },
      startDate: { lte: new Date('2025-11-24') },
      endDate: { gte: new Date('2025-11-24') },
    },
    select: {
      id: true,
      dailySlots: {
        where: {
          week: {
            startDate: { lte: new Date('2025-11-24') },
            endDate: { gte: new Date('2025-11-24') },
          }
        },
        select: {
          dayType: true,
          doctorSchedule: true,
          requiredStaff: true,
          departmentCategoryStaff: true,
        }
      }
    }
  });

  if (weekInfo && weekInfo.dailySlots.length > 0) {
    const slot = weekInfo.dailySlots[0];
    console.log('dayType:', slot.dayType);
    console.log('doctorSchedule:', slot.doctorSchedule);
    console.log('departmentCategoryStaff:', JSON.stringify(slot.departmentCategoryStaff, null, 2));

    const deptCatStaff = slot.departmentCategoryStaff || {};
    const required = deptCatStaff['진료실']?.['팀장실장급'] || 0;

    console.log(`\n필요: ${required}명`);
    console.log(`가능: ${active.length}명`);

    if (active.length < required) {
      console.log(`\n❌ 문제 발견: 활성 직원 ${active.length}명 < 필요 ${required}명`);
      console.log(`\n해결책: 팀장실장급 직원을 ${required - active.length}명 더 추가하거나,`);
      console.log(`        DoctorCombination의 팀장실장급 필수 인원을 줄여야 합니다.`);
    } else {
      console.log(`\n✅ 충분함`);
    }
  } else {
    console.log('DailySlot을 찾을 수 없습니다.');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
