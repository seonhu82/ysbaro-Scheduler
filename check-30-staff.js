const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check30Staff() {
  console.log('=== 30명 직원 가설 검증 ===\n');

  const allStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '진료실'
    }
  });

  console.log(`전체 진료실 직원: ${allStaff.length}명\n`);

  // 60 = 30 × 2 (주7일 - 주4일 = 3일이 아니라 2일?)
  // 73 = ?

  console.log('60과 73이 나올 수 있는 조합:\n');

  console.log('1. 목표 60:');
  console.log(`   - 30명 × 2일 = 60`);
  console.log(`   - 20명 × 3일 = 60`);
  console.log(`   - 15명 × 4일 = 60\n`);

  console.log('2. 현재 73:');
  console.log(`   - 73 / 6일 = ${(73/6).toFixed(2)}명/일`);
  console.log(`   - 73 / 7일 = ${(73/7).toFixed(2)}명/일`);
  console.log(`   - 73 - 60 = 13개 차이\n`);

  // 다른 가능성: Phase 1 실행 직후, Phase 2 실행 전
  // autoAssignStaff가 실제로 몇 명인지?
  const autoAssignDepartments = ['진료실', '데스크'];
  const autoAssignStaff = allStaff.filter(s =>
    autoAssignDepartments.includes(s.departmentName ?? '')
  );

  console.log(`자동 배치 대상 (진료실+데스크): ${autoAssignStaff.length}명\n`);

  if (autoAssignStaff.length === 30) {
    console.log('✓ 30명 발견!');
    console.log('   목표 = 30 × (영업일 - 4)');
    console.log('   만약 영업일이 2일이면 목표 = 30 × (2 - 4) = -60? (말이 안됨)');
    console.log('   만약 businessDays 계산 방식이 다르다면...\n');
  }

  // 데스크 직원 확인
  const deskStaff = await prisma.staff.findMany({
    where: {
      isActive: true,
      departmentName: '데스크'
    }
  });

  console.log(`데스크 직원: ${deskStaff.length}명`);
  console.log(`진료실 + 데스크: ${allStaff.length + deskStaff.length}명\n`);

  if (allStaff.length + deskStaff.length === 30) {
    console.log('✓ 진료실 + 데스크 = 30명!');
    console.log('   하지만 로그의 totalStaffCount는 autoAssignStaff만 포함함\n');
  }

  await prisma.$disconnect();
}

check30Staff();
