const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const clinicId = 'cmh697itv0001fw83azbrqe60';

async function check() {
  const monday = new Date('2025-11-24');

  console.log('📅 2025-11-24 (월요일) 팀장실장급 문제 확인\n');

  // DailySlot 확인
  const slot = await prisma.dailySlot.findFirst({
    where: { clinicId, date: monday },
    select: {
      doctorCombinationId: true,
      doctorCombination: {
        select: {
          doctors: true,
          requiredStaff: true,
        }
      }
    }
  });

  if (!slot) {
    console.log('❌ DailySlot 없음');
    await prisma.$disconnect();
    return;
  }

  console.log('의사 조합:', slot.doctorCombination.doctors);
  console.log('필수 인원:', JSON.stringify(slot.doctorCombination.requiredStaff, null, 2));

  // 팀장실장급 직원
  const staff = await prisma.staff.findMany({
    where: { clinicId, isActive: true, categoryName: '팀장실장급' },
    select: { id: true, name: true }
  });

  console.log(`\n팀장실장급 직원 (${staff.length}명):`);
  staff.forEach(s => console.log(`  - ${s.name}`));

  // 신청 확인
  const apps = await prisma.leaveApplication.findMany({
    where: {
      clinicId,
      date: monday,
      status: { in: ['CONFIRMED', 'PENDING'] },
      staff: { categoryName: '팀장실장급' }
    },
    select: {
      staff: { select: { name: true } },
      leaveType: true,
    }
  });

  console.log(`\n신청 현황 (${apps.length}건):`);
  if (apps.length === 0) console.log('  없음');
  else apps.forEach(a => console.log(`  - ${a.staff.name}: ${a.leaveType}`));

  const required = slot.doctorCombination.requiredStaff['팀장실장급'] || 0;
  const available = staff.length - apps.length;

  console.log(`\n📊 팀장실장급:`);
  console.log(`  필요: ${required}명`);
  console.log(`  전체: ${staff.length}명`);
  console.log(`  신청: ${apps.length}명`);
  console.log(`  가능: ${available}명`);
  console.log(available >= required ? '\n✅ 충분함' : '\n❌ 부족함');

  await prisma.$disconnect();
}

check().catch(console.error);
