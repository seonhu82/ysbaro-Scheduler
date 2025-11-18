const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findDahae() {
  try {
    // "다해" 직원 찾기
    const dahae = await prisma.staff.findFirst({
      where: {
        name: '다해'
      }
    });

    if (dahae) {
      console.log('✅ "다해" 직원 찾음:');
      console.log('  ID:', dahae.id);
      console.log('  이름:', dahae.name);
      console.log('  부서:', dahae.departmentName);
      console.log('  활성:', dahae.isActive);

      // 11월 18일 배정 확인
      const assignment = await prisma.staffAssignment.findFirst({
        where: {
          staffId: dahae.id,
          date: new Date('2025-11-18T00:00:00.000Z')
        }
      });

      if (assignment) {
        console.log('\n📋 11월 18일 배정:');
        console.log('  근무 타입:', assignment.shiftType);
        console.log('  스케줄 ID:', assignment.scheduleId);
      } else {
        console.log('\n❌ 11월 18일에 배정이 없습니다!');

        // 다른 날짜에 배정이 있는지 확인
        const otherAssignments = await prisma.staffAssignment.findMany({
          where: {
            staffId: dahae.id
          },
          orderBy: {
            date: 'desc'
          },
          take: 5
        });

        if (otherAssignments.length > 0) {
          console.log('\n최근 배정 기록 (최대 5개):');
          otherAssignments.forEach(a => {
            console.log(`  - ${a.date.toISOString().split('T')[0]}: ${a.shiftType}`);
          });
        } else {
          console.log('\n어떤 날짜에도 배정 기록이 없습니다.');
        }
      }
    } else {
      console.log('❌ "다해" 직원을 찾을 수 없습니다.');

      // "다" 로 시작하는 모든 직원 찾기
      const daStaff = await prisma.staff.findMany({
        where: {
          name: {
            startsWith: '다'
          }
        }
      });

      if (daStaff.length > 0) {
        console.log('\n"다"로 시작하는 직원들:');
        daStaff.forEach(s => {
          console.log(`  - ${s.name} (${s.departmentName}) [활성: ${s.isActive}]`);
        });
      }
    }

    // 진료실 전체 직원 수 확인
    const clinicStaff = await prisma.staff.count({
      where: {
        departmentName: '진료실',
        isActive: true
      }
    });

    console.log(`\n📊 진료실 전체 활성 직원 수: ${clinicStaff}명`);

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findDahae();
