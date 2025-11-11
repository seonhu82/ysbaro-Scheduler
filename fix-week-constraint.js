/**
 * 주4일 제약 수정 스크립트
 * - 프론트엔드에서 같은 주에 이미 선택된 OFF를 백엔드로 전달
 * - 백엔드에서 추가 선택을 포함하여 검증
 */

const fs = require('fs');

console.log('🔧 주4일 제약 수정 시작...\n');

// 1. SimulationRequest 인터페이스 수정
console.log('1️⃣  SimulationRequest 인터페이스 수정...');
const simulatorPath = 'D:/작업/프로그램 만들기/ysbaro-Scheduler/src/lib/services/leave-eligibility-simulator.ts';
let simulatorContent = fs.readFileSync(simulatorPath, 'utf8');

simulatorContent = simulatorContent.replace(
  /export interface SimulationRequest \{[\s\S]*?month: number\n\}/,
  `export interface SimulationRequest {
  clinicId: string
  staffId: string
  leaveDate: Date
  leaveType: 'ANNUAL' | 'OFF'
  year: number
  month: number
  existingOffsInWeek?: string[]  // 같은 주에 이미 선택된 OFF 날짜들 (YYYY-MM-DD)
}`
);

fs.writeFileSync(simulatorPath, simulatorContent, 'utf8');
console.log('✅ SimulationRequest 수정 완료\n');

// 2. checkWeek4DayConstraint 함수 수정
console.log('2️⃣  checkWeek4DayConstraint 함수 수정...');
simulatorContent = fs.readFileSync(simulatorPath, 'utf8');

// 함수 시그니처에 existingOffsInWeek 추가
simulatorContent = simulatorContent.replace(
  /async function checkWeek4DayConstraint\(\n  clinicId: string,\n  staffId: string,\n  leaveDate: Date,\n  leaveType: 'ANNUAL' \| 'OFF'\n\): Promise/,
  `async function checkWeek4DayConstraint(
  clinicId: string,
  staffId: string,
  leaveDate: Date,
  leaveType: 'ANNUAL' | 'OFF',
  existingOffsInWeek?: string[]  // 프론트엔드에서 이미 선택한 OFF 날짜들
): Promise`
);

// OFF 카운트 로직 수정 - 기존 선택 포함
simulatorContent = simulatorContent.replace(
  /  \/\/ 현재 OFF 수\n  let offCount = approvedOffs\.length\n\n  \/\/ 신청하려는 것이 OFF이고, 아직 신청하지 않은 날짜면 추가\n  if \(leaveType === 'OFF'\) \{[\s\S]*?\n  \}/,
  `  // 현재 OFF 수
  let offCount = approvedOffs.length

  // 프론트엔드에서 이미 선택한 OFF 추가 (중복 제외)
  if (existingOffsInWeek && existingOffsInWeek.length > 0) {
    for (const dateStr of existingOffsInWeek) {
      const alreadyInDb = approvedOffs.some(off => {
        const offDate = new Date(off.date)
        return offDate.toISOString().split('T')[0] === dateStr
      })
      if (!alreadyInDb) {
        offCount++
      }
    }
  }

  // 신청하려는 것이 OFF이고, 아직 카운트하지 않은 날짜면 추가
  if (leaveType === 'OFF') {
    const alreadyApplied = approvedOffs.some(off => {
      const offDate = new Date(off.date)
      return offDate.toISOString().split('T')[0] === leaveDate.toISOString().split('T')[0]
    })
    const alreadyInExisting = existingOffsInWeek?.includes(leaveDate.toISOString().split('T')[0])
    if (!alreadyApplied && !alreadyInExisting) {
      offCount++
    }
  }`
);

fs.writeFileSync(simulatorPath, simulatorContent, 'utf8');
console.log('✅ checkWeek4DayConstraint 수정 완료\n');

// 3. simulateScheduleWithLeave 함수 호출 부분 수정
console.log('3️⃣  simulateScheduleWithLeave 함수 수정...');
simulatorContent = fs.readFileSync(simulatorPath, 'utf8');

// checkWeek4DayConstraint 호출 시 existingOffsInWeek 전달
simulatorContent = simulatorContent.replace(
  /const weekConstraintCheck = await checkWeek4DayConstraint\(\n    req\.clinicId,\n    req\.staffId,\n    req\.leaveDate,\n    req\.leaveType\n  \)/,
  `const weekConstraintCheck = await checkWeek4DayConstraint(
    req.clinicId,
    req.staffId,
    req.leaveDate,
    req.leaveType,
    req.existingOffsInWeek
  )`
);

fs.writeFileSync(simulatorPath, simulatorContent, 'utf8');
console.log('✅ simulateScheduleWithLeave 수정 완료\n');

// 4. can-apply API 수정
console.log('4️⃣  can-apply API 수정...');
const canApplyPath = 'D:/작업/프로그램 만들기/ysbaro-Scheduler/src/app/api/leave-apply/[token]/can-apply/route.ts';
let canApplyContent = fs.readFileSync(canApplyPath, 'utf8');

// existingOffsInWeek 파라미터 파싱 추가
canApplyContent = canApplyContent.replace(
  /const searchParams = request\.nextUrl\.searchParams\n    const staffId = searchParams\.get\('staffId'\)\n    const dateStr = searchParams\.get\('date'\)\n    const type = searchParams\.get\('type'\) as 'ANNUAL' \| 'OFF' \| null/,
  `const searchParams = request.nextUrl.searchParams
    const staffId = searchParams.get('staffId')
    const dateStr = searchParams.get('date')
    const type = searchParams.get('type') as 'ANNUAL' | 'OFF' | null
    const existingOffsInWeekParam = searchParams.get('existingOffsInWeek')
    const existingOffsInWeek = existingOffsInWeekParam ? existingOffsInWeekParam.split(',') : []`
);

// simulateScheduleWithLeave 호출 시 existingOffsInWeek 전달
canApplyContent = canApplyContent.replace(
  /const simulation = await simulateScheduleWithLeave\(\{\n      clinicId: link\.clinicId,\n      staffId,\n      leaveDate: requestDate,\n      leaveType: type,\n      year,\n      month,\n    \}\)/,
  `const simulation = await simulateScheduleWithLeave({
      clinicId: link.clinicId,
      staffId,
      leaveDate: requestDate,
      leaveType: type,
      year,
      month,
      existingOffsInWeek: existingOffsInWeek.length > 0 ? existingOffsInWeek : undefined,
    })`
);

fs.writeFileSync(canApplyPath, canApplyContent, 'utf8');
console.log('✅ can-apply API 수정 완료\n');

console.log('🎉 모든 수정 완료!');
console.log('\n📝 변경 사항:');
console.log('  - SimulationRequest에 existingOffsInWeek 필드 추가');
console.log('  - checkWeek4DayConstraint가 이미 선택된 OFF를 카운트에 포함');
console.log('  - 프론트엔드에서 같은 주의 선택된 OFF를 API로 전달');
console.log('  - can-apply API가 existingOffsInWeek를 시뮬레이터로 전달');
console.log('\n🧪 테스트:');
console.log('  1. 11월 25일 OFF 선택');
console.log('  2. 11월 26일 OFF 선택 → 통과 (2일)');
console.log('  3. 11월 27일 OFF 선택 → 차단 (근무 가능일 3일 < 최소 4일)');
