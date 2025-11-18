const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateScheduleIntegrity() {
  try {
    console.log('=== 스케줄 무결성 검증 ===\n');

    // 1. Clinic ID 가져오기 (첫 번째 클리닉)
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      console.log('❌ 클리닉을 찾을 수 없습니다.');
      return;
    }

    const clinicId = clinic.id;
    console.log(`클리닉: ${clinic.name} (${clinicId})\n`);

    // 2. 부서별 활성 직원 수 조회
    const departments = await prisma.department.findMany({
      where: { clinicId }
    });

    const departmentStaffCount = new Map();
    for (const dept of departments) {
      const count = await prisma.staff.count({
        where: {
          clinicId,
          departmentName: dept.name,
          isActive: true
        }
      });
      departmentStaffCount.set(dept.name, {
        total: count,
        useAutoAssignment: dept.useAutoAssignment
      });
    }

    console.log('📊 부서별 활성 직원 수:');
    departmentStaffCount.forEach((info, deptName) => {
      const type = info.useAutoAssignment ? '자동배치' : '수동배치';
      console.log(`  ${deptName}: ${info.total}명 (${type})`);
    });

    // 3. 11월 스케줄 조회
    const schedule = await prisma.schedule.findFirst({
      where: {
        year: 2025,
        month: 11
      }
    });

    if (!schedule) {
      console.log('\n❌ 2025년 11월 스케줄을 찾을 수 없습니다.');
      return;
    }

    console.log(`스케줄 클리닉 ID: ${schedule.clinicId}`);

    console.log(`\n✅ 스케줄 ID: ${schedule.id} (상태: ${schedule.status})\n`);

    // 4. 11월 전체 날짜에 대해 검증
    console.log('=== 날짜별 무결성 검증 ===\n');

    const errors = [];
    const warnings = [];

    for (let day = 1; day <= 30; day++) {
      const date = new Date(Date.UTC(2025, 10, day)); // 11월 = month 10
      const dateStr = date.toISOString().split('T')[0];

      // 해당 날짜의 모든 배정 조회
      const assignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: date
        },
        include: {
          staff: {
            select: {
              departmentName: true
            }
          }
        }
      });

      // 해당 날짜의 모든 연차 조회
      const leaves = await prisma.leaveApplication.findMany({
        where: {
          clinicId,
          date: date,
          leaveType: 'ANNUAL',
          status: { in: ['CONFIRMED', 'ON_HOLD'] }
        },
        include: {
          staff: {
            select: {
              id: true,
              name: true,
              departmentName: true
            }
          }
        }
      });

      // 부서별 집계
      const deptStats = new Map();
      departments.forEach(dept => {
        deptStats.set(dept.name, {
          working: 0, // DAY, NIGHT
          off: 0,     // OFF (연차 제외)
          annual: 0,  // ANNUAL
          total: 0,
          staffIds: new Set()
        });
      });

      // StaffAssignment 집계
      assignments.forEach(a => {
        const deptName = a.staff.departmentName;
        if (deptStats.has(deptName)) {
          const stats = deptStats.get(deptName);
          stats.staffIds.add(a.staffId);

          if (a.shiftType === 'OFF') {
            // OFF인 경우, 연차인지 확인
            const isAnnual = leaves.some(l => l.staffId === a.staffId);
            if (isAnnual) {
              stats.annual++;
            } else {
              stats.off++;
            }
          } else {
            // DAY, NIGHT
            stats.working++;
          }
        }
      });

      // LeaveApplication 중 StaffAssignment에 없는 ANNUAL 집계
      leaves.forEach(l => {
        const deptName = l.staff.departmentName;
        if (deptStats.has(deptName)) {
          const stats = deptStats.get(deptName);
          if (!stats.staffIds.has(l.staffId)) {
            stats.annual++;
            stats.staffIds.add(l.staffId);
          }
        }
      });

      // 총합 계산
      deptStats.forEach(stats => {
        stats.total = stats.working + stats.off + stats.annual;
      });

      // 검증
      let hasError = false;
      const dayErrors = [];

      deptStats.forEach((stats, deptName) => {
        const expected = departmentStaffCount.get(deptName)?.total || 0;
        if (stats.total !== expected) {
          hasError = true;
          const diff = expected - stats.total;
          dayErrors.push({
            dept: deptName,
            expected,
            actual: stats.total,
            working: stats.working,
            off: stats.off,
            annual: stats.annual,
            missing: diff
          });
        }
      });

      if (hasError) {
        console.log(`❌ ${dateStr} (11월 ${day}일):`);
        dayErrors.forEach(err => {
          console.log(`   ${err.dept}: 예상 ${err.expected}명, 실제 ${err.actual}명 (근무 ${err.working}, 오프 ${err.off}, 연차 ${err.annual}) → 누락 ${err.missing}명`);
          errors.push({
            date: dateStr,
            ...err
          });
        });
      }
    }

    // 결과 요약
    console.log('\n=== 검증 결과 ===');
    if (errors.length === 0) {
      console.log('✅ 모든 날짜의 스케줄이 정상입니다.');
    } else {
      console.log(`❌ 총 ${errors.length}개의 오류가 발견되었습니다.\n`);

      // 부서별, 날짜별 그룹화
      const errorsByDept = new Map();
      errors.forEach(err => {
        if (!errorsByDept.has(err.dept)) {
          errorsByDept.set(err.dept, []);
        }
        errorsByDept.get(err.dept).push(err);
      });

      errorsByDept.forEach((errs, dept) => {
        console.log(`\n📌 ${dept} 부서 (${errs.length}일 오류):`);
        errs.forEach(err => {
          console.log(`   ${err.date}: ${err.missing}명 누락 (${err.actual}/${err.expected})`);
        });
      });
    }

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateScheduleIntegrity();
