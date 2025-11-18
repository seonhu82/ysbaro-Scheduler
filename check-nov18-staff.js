const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNov18Staff() {
  try {
    console.log('=== 11월 18일 직원 배정 조회 ===\n');

    // 11/18 스케줄 조회
    const assignments = await prisma.staffAssignment.findMany({
      where: {
        date: new Date('2025-11-18T00:00:00.000Z')
      },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            departmentName: true,
            categoryName: true,
            rank: true
          }
        },
        substituteForStaff: {
          select: {
            id: true,
            name: true,
            departmentName: true
          }
        }
      },
      orderBy: {
        staff: {
          name: 'asc'
        }
      }
    });

    console.log(`총 ${assignments.length}명 배정됨\n`);

    // shiftType별 그룹화
    const byShiftType = {
      DAY: [],
      NIGHT: [],
      OFF: []
    };

    assignments.forEach(a => {
      byShiftType[a.shiftType].push(a);
    });

    console.log(`📋 근무 배정 (DAY): ${byShiftType.DAY.length}명`);
    byShiftType.DAY.forEach(a => {
      let info = `  - ${a.staff.name} (${a.staff.departmentName || '미지정'})`;
      if (a.isSubstitute && a.substituteForStaff) {
        info += ` 🔄 대체근무 <- ${a.substituteForStaff.name}`;
      }
      console.log(info);
    });

    console.log(`\n🌙 야간 배정 (NIGHT): ${byShiftType.NIGHT.length}명`);
    byShiftType.NIGHT.forEach(a => {
      let info = `  - ${a.staff.name} (${a.staff.departmentName || '미지정'})`;
      if (a.isSubstitute && a.substituteForStaff) {
        info += ` 🔄 대체근무 <- ${a.substituteForStaff.name}`;
      }
      console.log(info);
    });

    console.log(`\n💤 오프 배정 (OFF): ${byShiftType.OFF.length}명`);
    byShiftType.OFF.forEach(a => {
      console.log(`  - ${a.staff.name} (${a.staff.departmentName || '미지정'})`);
    });

    // "다해" 또는 "다애" 이름 검색
    console.log('\n🔍 "다" 로 시작하는 이름 검색:');
    const daNames = assignments.filter(a => a.staff.name.startsWith('다'));
    if (daNames.length > 0) {
      daNames.forEach(a => {
        console.log(`  - 이름: "${a.staff.name}", 부서: ${a.staff.departmentName}, 근무: ${a.shiftType}`);
      });
    } else {
      console.log('  없음');
    }

    // 부서별 통계
    console.log('\n📊 부서별 근무 인원 (OFF 제외):');
    const deptStats = new Map();
    assignments
      .filter(a => a.shiftType !== 'OFF')
      .forEach(a => {
        const dept = a.staff.departmentName || '미지정';
        if (!deptStats.has(dept)) {
          deptStats.set(dept, 0);
        }
        deptStats.set(dept, deptStats.get(dept) + 1);
      });

    deptStats.forEach((count, dept) => {
      console.log(`  ${dept}: ${count}명`);
    });

    // 연차 신청 확인
    console.log('\n📝 11월 18일 연차/오프 신청:');
    const leaves = await prisma.leaveApplication.findMany({
      where: {
        date: new Date('2025-11-18T00:00:00.000Z')
      },
      include: {
        staff: {
          select: {
            name: true,
            departmentName: true
          }
        }
      }
    });

    if (leaves.length > 0) {
      leaves.forEach(l => {
        console.log(`  - ${l.staff.name} (${l.staff.departmentName}): ${l.leaveType} [${l.status}]`);
      });
    } else {
      console.log('  없음');
    }

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNov18Staff();
