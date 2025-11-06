const fs = require('fs');

const filePath = 'src/app/api/schedule/auto-assign/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Phase 2가 있는지 확인
if (!content.includes('2차 배치')) {
  console.log('❌ Phase 2 로직을 찾을 수 없습니다.');
  process.exit(1);
}

// 수정할 부분 찾기
const oldCode = `            for (const assignment of offAssignments) {
              const dateKey = assignment.date.toISOString().split('T')[0]
              const offCountOnDate = await prisma.staffAssignment.count({
                where: {
                  scheduleId: schedule.id,
                  date: assignment.date,
                  shiftType: 'OFF'
                }
              })

              if (offCountOnDate > maxOffCount ||
                  (offCountOnDate === maxOffCount && (!bestCandidate || Math.random() < 0.5))) {
                maxOffCount = offCountOnDate
                bestCandidate = { staff, assignment }
                bestDate = assignment.date
              }
            }
          }

          if (!bestCandidate) {
            console.log(\`      ⚠️ 변경 가능한 OFF 없음\`)
            break
          }

          // 원장 스케줄 확인
          const doctorSchedule = await prisma.scheduleDoctor.findFirst({
            where: { scheduleId: schedule.id, date: bestDate! }
          })

          if (!doctorSchedule) {
            console.log(\`      ⚠️ \${bestDate!.toISOString().split('T')[0]} 원장 스케줄 없음\`)
            continue
          }

          // B-3. OFF → 근무 변경
          await prisma.staffAssignment.update({
            where: {
              scheduleId_staffId_date: {
                scheduleId: schedule.id,
                staffId: bestCandidate.staff.id,
                date: bestDate!
              }
            },
            data: {
              shiftType: doctorSchedule.hasNightShift ? 'NIGHT' : 'DAY'
            }
          })

          phase2Adjustments++`;

const newCode = `            for (const assignment of offAssignments) {
              // 먼저 원장 스케줄 확인 (원장 근무 없는 날은 스킵)
              const doctorSchedule = await prisma.scheduleDoctor.findFirst({
                where: { scheduleId: schedule.id, date: assignment.date }
              })

              if (!doctorSchedule) {
                continue // 원장 근무 없는 날은 건너뛰기
              }

              const dateKey = assignment.date.toISOString().split('T')[0]
              const offCountOnDate = await prisma.staffAssignment.count({
                where: {
                  scheduleId: schedule.id,
                  date: assignment.date,
                  shiftType: 'OFF'
                }
              })

              if (offCountOnDate > maxOffCount ||
                  (offCountOnDate === maxOffCount && (!bestCandidate || Math.random() < 0.5))) {
                maxOffCount = offCountOnDate
                bestCandidate = { staff, assignment, doctorSchedule }
                bestDate = assignment.date
              }
            }
          }

          if (!bestCandidate) {
            console.log(\`      ⚠️ 변경 가능한 OFF 없음 (원장 근무 있는 날 중)\`)
            break
          }

          // B-3. OFF → 근무 변경
          await prisma.staffAssignment.update({
            where: {
              scheduleId_staffId_date: {
                scheduleId: schedule.id,
                staffId: bestCandidate.staff.id,
                date: bestDate!
              }
            },
            data: {
              shiftType: bestCandidate.doctorSchedule.hasNightShift ? 'NIGHT' : 'DAY'
            }
          })

          phase2Adjustments++`;

if (!content.includes(oldCode)) {
  console.log('❌ 수정할 코드를 찾을 수 없습니다. 파일이 이미 수정되었거나 다른 버전입니다.');
  console.log('\n확인이 필요한 부분:');
  console.log('- for (const assignment of offAssignments)');
  console.log('- 원장 스케줄 확인');
  process.exit(1);
}

// 코드 교체
content = content.replace(oldCode, newCode);

// 파일 저장
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Phase 2 수정 완료!');
console.log('\n변경 내용:');
console.log('1. 원장 스케줄 확인을 루프 안으로 이동');
console.log('2. 원장 근무 없는 날은 continue로 건너뛰기');
console.log('3. bestCandidate에 doctorSchedule 포함');
console.log('4. bestCandidate.doctorSchedule 사용');
