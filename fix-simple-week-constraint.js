/**
 * 주4일 제약을 간단하게 수정
 * 핵심: 주당 OFF가 2개를 초과하면 차단
 */

const fs = require('fs');

console.log('🔧 주4일 제약 간단하게 수정...\n');

const simulatorPath = 'D:/작업/프로그램 만들기/ysbaro-Scheduler/src/lib/services/leave-eligibility-simulator.ts';
let content = fs.readFileSync(simulatorPath, 'utf8');

// checkWeek4DayConstraint 함수 전체를 간단하게 교체
const oldFunction = /async function checkWeek4DayConstraint\([\s\S]*?\n\n  return \{ allowed: true \}\n\}/;

const newFunction = `async function checkWeek4DayConstraint(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  leaveType: 'ANNUAL' | 'OFF',
  existingOffsInWeek?: string[]  // 프론트엔드에서 이미 선택한 OFF 날짜들
): Promise<{ allowed: boolean; message?: string; details?: any }> {
  const weekStart = getWeekStart(leaveDate)
  const weekEnd = getWeekEnd(leaveDate)

  console.log('🔍 [주4일 체크] 주 범위:', weekStart.toISOString().split('T')[0], '~', weekEnd.toISOString().split('T')[0])

  // OFF가 아니면 통과 (연차는 근무일로 계산)
  if (leaveType !== 'OFF') {
    return { allowed: true }
  }

  // DB에서 해당 주의 승인된/대기중 OFF 조회
  const approvedOffs = await prisma.leaveApplication.findMany({
    where: {
      staffId,
      clinicId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
      leaveType: 'OFF',
      status: {
        in: ['CONFIRMED', 'PENDING']
      }
    },
    select: { date: true }
  })

  console.log('📊 [주4일 체크] DB OFF 수:', approvedOffs.length)

  // 현재 OFF 카운트 = DB OFF 수
  let totalOffs = approvedOffs.length

  // 프론트엔드에서 이미 선택한 OFF 추가 (DB에 없는 것만)
  if (existingOffsInWeek && existingOffsInWeek.length > 0) {
    for (const dateStr of existingOffsInWeek) {
      const alreadyInDb = approvedOffs.some(off => {
        const offDate = new Date(off.date)
        return offDate.toISOString().split('T')[0] === dateStr
      })
      if (!alreadyInDb) {
        totalOffs++
      }
    }
    console.log('📊 [주4일 체크] 프론트엔드 추가 선택 후 OFF 수:', totalOffs)
  }

  // 현재 신청하려는 날짜가 아직 카운트 안됐으면 추가
  const currentDateStr = leaveDate.toISOString().split('T')[0]
  const alreadyInDb = approvedOffs.some(off => {
    const offDate = new Date(off.date)
    return offDate.toISOString().split('T')[0] === currentDateStr
  })
  const alreadySelected = existingOffsInWeek?.includes(currentDateStr)

  if (!alreadyInDb && !alreadySelected) {
    totalOffs++
  }

  console.log('📊 [주4일 체크] 최종 OFF 수 (현재 신청 포함):', totalOffs)

  // 주당 OFF 2개 초과 시 차단
  const MAX_OFFS_PER_WEEK = 2

  if (totalOffs > MAX_OFFS_PER_WEEK) {
    return {
      allowed: false,
      message: \`이번 주(\${weekStart.toISOString().split('T')[0]} ~ \${weekEnd.toISOString().split('T')[0]})에 이미 \${totalOffs - 1}개의 OFF가 있습니다. 주당 최대 \${MAX_OFFS_PER_WEEK}개까지만 신청 가능합니다.\`,
      details: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        currentOffs: totalOffs - 1,
        maxAllowed: MAX_OFFS_PER_WEEK,
      }
    }
  }

  return { allowed: true }
}`;

content = content.replace(oldFunction, newFunction);
fs.writeFileSync(simulatorPath, content, 'utf8');

console.log('✅ 주4일 제약 수정 완료');
console.log('\n📝 새로운 로직:');
console.log('  - 주당 OFF 2개 초과 시 차단');
console.log('  - DB OFF + 프론트엔드 선택 OFF + 현재 신청 OFF를 모두 합산');
console.log('  - 연차는 OFF로 카운트하지 않음');
console.log('\n🧪 테스트:');
console.log('  - 주당 OFF 0개 → 1번째 선택 가능');
console.log('  - 주당 OFF 1개 → 2번째 선택 가능');
console.log('  - 주당 OFF 2개 → 3번째 선택 차단 ❌');
