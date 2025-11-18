const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSubstitute() {
  try {
    // 혜숙과 해선 찾기
    const hyesuk = await prisma.staff.findFirst({
      where: { name: '혜숙', departmentName: '진료실' }
    });

    const haeseon = await prisma.staff.findFirst({
      where: { name: '해선', departmentName: '진료실' }
    });

    if (!hyesuk || !haeseon) {
      console.log('직원을 찾을 수 없습니다');
      return;
    }

    console.log('혜숙 ID:', hyesuk.id);
    console.log('해선 ID:', haeseon.id);

    // 11/18 혜숙의 배정 찾기
    const assignment = await prisma.staffAssignment.findFirst({
      where: {
        staffId: hyesuk.id,
        date: new Date('2025-11-18T00:00:00.000Z'),
        shiftType: 'DAY'
      }
    });

    if (!assignment) {
      console.log('혜숙의 배정을 찾을 수 없습니다');
      return;
    }

    console.log('배정 ID:', assignment.id);

    // 대체 근무 정보 업데이트
    const updated = await prisma.staffAssignment.update({
      where: { id: assignment.id },
      data: {
        isSubstitute: true,
        substituteForStaffId: haeseon.id,
        substitutedAt: new Date()
      }
    });

    console.log('✅ 대체 근무 정보가 업데이트되었습니다:', updated);

  } catch (error) {
    console.error('❌ 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSubstitute();
