const fs = require('fs');

const filePath = 'src/app/api/schedule/auto-assign/route.ts';
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// 1000줄부터 1227줄까지 찾기 (0-based index이므로 999~1226)
const startLine = 999; // 1000번째 줄
const endLine = 1226; // 1227번째 줄

// 새로운 Phase 2 + Phase 3 코드
const newPhase2And3 = `    // ==================== 2차 배치: 주별 OFF 목표값 기준 균등 배치 ====================
    console.log(\`\\n========== 2차 배치 시작: 주별 OFF 균등화 ==========\`)

    // 모든 주차 추출 (전체 배치 범위 기준)
    const allWeekKeys = new Set<string>()
    for (const dateKey of allDatesInRange) {
      const date = new Date(dateKey + 'T00:00:00.000Z')
      allWeekKeys.add(getWeekKey(date))
    }

    console.log(\`\\n📅 배치 범위 주차: \${Array.from(allWeekKeys).sort().join(', ')}\`)

    const autoAssignStaff = allStaff.filter(s => autoAssignDepartments.includes(s.departmentName ?? ''))
    const offTarget = (weekBusinessDays - defaultWorkDays) * autoAssignStaff.length
    console.log(\`📊 주별 OFF 목표값: \${offTarget}건 = (\${weekBusinessDays} - \${defaultWorkDays}) × \${autoAssignStaff.length}명\\n\`)

    // 각 주차별로 OFF 목표값 달성
    let phase2Adjustments = 0
    for (const weekKey of Array.from(allWeekKeys).sort()) {
      // 주차 날짜 범위 계산
      const [yearStr, weekStr] = weekKey.split('-W')
      const weekYear = parseInt(yearStr)
      const weekNumber = parseInt(weekStr)

      const firstDayOfYear = new Date(weekYear, 0, 1)
      const firstSunday = new Date(firstDayOfYear)
      const firstDayOfWeek = firstDayOfYear.getDay()
      if (firstDayOfWeek !== 0) {
        firstSunday.setDate(firstDayOfYear.getDate() + (7 - firstDayOfWeek))
      }

      const sundayOfWeek = new Date(firstSunday)
      sundayOfWeek.setDate(firstSunday.getDate() + (weekNumber - 1) * 7)
      const weekStart = new Date(sundayOfWeek)
      const weekEnd = new Date(sundayOfWeek)
      weekEnd.setDate(weekEnd.getDate() + 6)

      console.log(\`\\n🗓️  \${weekKey} (\${weekStart.toISOString().split('T')[0]} ~ \${weekEnd.toISOString().split('T')[0]}):\`)

      // A. 현재 OFF 수 집계
      const currentOffCount = await prisma.staffAssignment.count({
        where: {
          scheduleId: schedule.id,
          date: { gte: weekStart, lte: weekEnd },
          shiftType: 'OFF'
        }
      })

      console.log(\`   - 현재 OFF: \${currentOffCount}건\`)
      console.log(\`   - 목표 OFF: \${offTarget}건\`)

      const diff = offTarget - currentOffCount
      if (diff === 0) {
        console.log(\`   ✅ OFF 목표 달성\`)
        continue
      }

      console.log(\`   \${diff > 0 ? '⚠️' : '📊'} 조정 필요: \${diff > 0 ? '+' : ''}\${diff}건 (\${diff > 0 ? '근무→OFF' : 'OFF→근무'})\`)

      // B. 조정 실행
      if (diff > 0) {
        // 근무 → OFF 변경 (주4일 초과 직원 대상)
        for (let i = 0; i < diff; i++) {
          // B-1. 주4일 초과한 직원 찾기
          const candidates = []
          for (const staff of autoAssignStaff) {
            const workDays = await calculateWeeklyWorkDays(
              staff.id, weekKey, schedule.id, confirmedLeaves,
              dailyAssignments, previousDeployedSchedule?.id || null
            )
            if (workDays > defaultWorkDays) {
              candidates.push({ staff, workDays })
            }
          }

          if (candidates.length === 0) {
            console.log(\`      ⚠️ 주\${defaultWorkDays}일 초과 직원 없음, 조정 중단\`)
            break
          }

          // B-2. OFF가 가장 적은 날짜의 근무 중에서 형평성 편차 낮은 직원 선택
          let bestCandidate: any = null
          let bestDate: Date | null = null
          let minOffCount = Infinity

          for (const { staff } of candidates) {
            // 이 직원의 근무 날짜들 조회
            const workAssignments = await prisma.staffAssignment.findMany({
              where: {
                scheduleId: schedule.id,
                staffId: staff.id,
                date: { gte: weekStart, lte: weekEnd },
                shiftType: { in: ['DAY', 'NIGHT'] }
              }
            })

            for (const assignment of workAssignments) {
              const dateKey = assignment.date.toISOString().split('T')[0]
              const offCountOnDate = await prisma.staffAssignment.count({
                where: {
                  scheduleId: schedule.id,
                  date: assignment.date,
                  shiftType: 'OFF'
                }
              })

              if (offCountOnDate < minOffCount ||
                  (offCountOnDate === minOffCount && (!bestCandidate || Math.random() < 0.5))) {
                minOffCount = offCountOnDate
                bestCandidate = { staff, assignment }
                bestDate = assignment.date
              }
            }
          }

          if (!bestCandidate) {
            console.log(\`      ⚠️ 변경 가능한 근무 없음\`)
            break
          }

          // B-3. 근무 → OFF 변경
          await prisma.staffAssignment.update({
            where: {
              scheduleId_staffId_date: {
                scheduleId: schedule.id,
                staffId: bestCandidate.staff.id,
                date: bestCandidate.assignment.date
              }
            },
            data: { shiftType: 'OFF' }
          })

          phase2Adjustments++
          console.log(\`      ✅ \${bestDate!.toISOString().split('T')[0]}: \${bestCandidate.staff.name} 근무→OFF\`)
        }
      } else {
        // OFF → 근무 변경 (주4일 미달 직원 대상)
        for (let i = 0; i < Math.abs(diff); i++) {
          // B-1. 주4일 미달 직원 찾기
          const candidates = []
          for (const staff of autoAssignStaff) {
            const workDays = await calculateWeeklyWorkDays(
              staff.id, weekKey, schedule.id, confirmedLeaves,
              dailyAssignments, previousDeployedSchedule?.id || null
            )
            if (workDays < defaultWorkDays) {
              candidates.push({ staff, workDays })
            }
          }

          if (candidates.length === 0) {
            console.log(\`      ⚠️ 주\${defaultWorkDays}일 미달 직원 없음, 조정 중단\`)
            break
          }

          // B-2. OFF가 가장 많은 날짜의 OFF 중에서 선택 (원장 근무 있는 날만)
          let bestCandidate: any = null
          let bestDate: Date | null = null
          let maxOffCount = -1

          for (const { staff } of candidates) {
            // 이 직원의 OFF 날짜들 조회
            const offAssignments = await prisma.staffAssignment.findMany({
              where: {
                scheduleId: schedule.id,
                staffId: staff.id,
                date: { gte: weekStart, lte: weekEnd },
                shiftType: 'OFF'
              }
            })

            for (const assignment of offAssignments) {
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

          phase2Adjustments++
          totalAssignments++
          console.log(\`      ✅ \${bestDate!.toISOString().split('T')[0]}: \${bestCandidate.staff.name} OFF→근무\`)
        }
      }
    }

    console.log(\`\\n✅ 2차 배치 완료: \${phase2Adjustments}건 조정\`)
    console.log(\`========== 2차 배치 완료 ==========\\n\`)

    // ==================== 3차 공휴일 처리: 모든 공휴일 근무 → OFF 변경 ====================
    console.log(\`\\n========== 3차 공휴일 처리 시작 ==========\`)

    // 배치 범위의 모든 공휴일 조회 (실제 배치 범위 기준)
    const holidaysInRange = await prisma.holiday.findMany({
      where: {
        clinicId,
        date: {
          gte: actualDateRange.min,
          lte: actualDateRange.max
        }
      }
    })

    console.log(\`\\n📅 처리 대상 공휴일: \${holidaysInRange.length}개\`)
    if (holidaysInRange.length > 0) {
      console.log(\`   \${holidaysInRange.map(h => \`\${h.date.toISOString().split('T')[0]} (\${h.name})\`).join(', ')}\\n\`)
    }

    let holidayChanges = 0
    for (const holiday of holidaysInRange) {
      const holidayAssignments = await prisma.staffAssignment.findMany({
        where: {
          scheduleId: schedule.id,
          date: holiday.date,
          shiftType: { in: ['DAY', 'NIGHT'] }
        }
      })

      for (const assignment of holidayAssignments) {
        await prisma.staffAssignment.update({
          where: {
            scheduleId_staffId_date: {
              scheduleId: schedule.id,
              staffId: assignment.staffId,
              date: holiday.date
            }
          },
          data: { shiftType: 'OFF' }
        })
        holidayChanges++
      }

      if (holidayAssignments.length > 0) {
        console.log(\`   ✅ \${holiday.date.toISOString().split('T')[0]} (\${holiday.name}): \${holidayAssignments.length}명 OFF 변경\`)
      }
    }

    console.log(\`\\n✅ 3차 공휴일 처리 완료: \${holidayChanges}건 변경\`)
    console.log(\`========== 3차 공휴일 처리 완료 ==========\\n\`)
`;

// 기존 Phase 2 부분 제거하고 새로운 코드 삽입
const beforePhase2 = lines.slice(0, startLine).join('\n');
const afterPhase2 = lines.slice(endLine + 1).join('\n');

const newContent = beforePhase2 + '\n' + newPhase2And3 + '\n' + afterPhase2;

// 파일 저장
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('✅ Phase 2 + Phase 3 교체 완료!');
console.log(`\n변경 내용:`);
console.log(`- 기존 라인 ${startLine + 1}~${endLine + 1} 제거`);
console.log(`- 새로운 Phase 2: 주별 OFF 목표값 기준 균등 배치`);
console.log(`- 새로운 Phase 3: 공휴일 일괄 OFF 처리`);
console.log(`- 원장 스케줄 체크를 OFF→근무 변경 시 먼저 수행`);
