// 직원별 근무일수 분포 확인 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDistribution() {
  try {
    console.log('\n=== 2025년 10월 직원별 근무일수 확인 ===\n');

    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 10
      }
    });

    if (!schedule) {
      console.log('❌ 스케줄이 없습니다.');
      return;
    }

    // 진료실 직원 목록
    const staff = await prisma.staff.findMany({
      where: {
        isActive: true,
        departmentName: '진료실'
      },
      select: {
        id: true,
        name: true,
        categoryName: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`진료실 활성 직원: ${staff.length}명\n`);

    // 각 직원별 근무일수 계산
    const results = [];

    for (const s of staff) {
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          staffId: s.id,
          shiftType: { not: 'OFF' }
        },
        include: {
          schedule: true
        }
      });

      const nightShifts = assignments.filter(a => a.shiftType === 'NIGHT').length;
      const weekends = assignments.filter(a => {
        const day = new Date(a.date).getDay();
        return day === 0 || day === 6;
      }).length;

      results.push({
        name: s.name,
        category: s.categoryName,
        totalDays: assignments.length,
        nightShifts,
        weekends
      });
    }

    // 카테고리별로 정렬
    const categoryOrder = { '팀장/실장': 0, '고년차': 1, '중간년차': 2, '저년차': 3 };
    results.sort((a, b) => {
      const orderA = categoryOrder[a.category] ?? 999;
      const orderB = categoryOrder[b.category] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    // 결과 출력
    console.log('이름\t\t카테고리\t총 근무일\t야간\t주말');
    console.log('='.repeat(60));

    results.forEach(r => {
      const nameLen = r.name.length > 6 ? '\t' : '\t\t';
      console.log(`${r.name}${nameLen}${r.category}\t\t${r.totalDays}일\t\t${r.nightShifts}일\t${r.weekends}일`);
    });

    // 통계
    const totalDays = results.reduce((sum, r) => sum + r.totalDays, 0);
    const avgDays = totalDays / results.length;
    const maxDays = Math.max(...results.map(r => r.totalDays));
    const minDays = Math.min(...results.map(r => r.totalDays));

    console.log('\n' + '='.repeat(60));
    console.log(`평균 근무일: ${avgDays.toFixed(1)}일`);
    console.log(`최대 근무일: ${maxDays}일`);
    console.log(`최소 근무일: ${minDays}일`);
    console.log(`편차: ${maxDays - minDays}일`);

    // 문제 있는 직원
    const problems = results.filter(r => r.totalDays === 0 || r.totalDays > 25);
    if (problems.length > 0) {
      console.log('\n⚠️  문제 있는 배치:');
      problems.forEach(p => {
        if (p.totalDays === 0) {
          console.log(`  - ${p.name}: 근무일 0일 (배치 안됨)`);
        } else {
          console.log(`  - ${p.name}: 근무일 ${p.totalDays}일 (과다)`);
        }
      });
    }

  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDistribution();
