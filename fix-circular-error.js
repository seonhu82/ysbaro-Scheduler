const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/calendar/DayDetailPopup.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Circular structure 오류 수정: payload를 JSON.parse(JSON.stringify())로 감싸기
const oldPayload = `      // API로 직접 저장 (필요한 필드만 추출)
      const payload = {
        date: schedule.date,
        doctors: schedule.doctors?.map((d: any) => ({ id: d.id, name: d.name })) || [],
        staff: schedule.staff?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        annualLeave: schedule.annualLeave?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        offDays: schedule.offDays?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        isNightShift: schedule.isNightShift,
        year,
        month,
        skipValidation
      }

      const response = await fetch('/api/schedule/day', {`;

const newPayload = `      // API로 직접 저장 (필요한 필드만 추출)
      // JSON.parse(JSON.stringify())로 완전히 새로운 객체 생성하여 circular reference 방지
      const payload = JSON.parse(JSON.stringify({
        date: schedule.date,
        doctors: schedule.doctors?.map((d: any) => ({ id: d.id, name: d.name })) || [],
        staff: schedule.staff?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        annualLeave: schedule.annualLeave?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        offDays: schedule.offDays?.map((s: any) => ({
          id: s.id,
          name: s.name,
          rank: s.rank,
          categoryName: s.categoryName,
          departmentName: s.departmentName
        })) || [],
        isNightShift: schedule.isNightShift,
        year,
        month,
        skipValidation
      }))

      console.log('📤 Saving payload:', payload)

      const response = await fetch('/api/schedule/day', {`;

if (content.includes(oldPayload)) {
  content = content.replace(oldPayload, newPayload);
  console.log('✅ Circular structure 오류 수정 완료');
} else {
  console.log('⚠️ Circular structure 패턴을 찾을 수 없습니다. 파일이 이미 수정되었거나 다른 상태일 수 있습니다.');
}

// 2. 필터링 디버깅 로그 제거 (있다면)
const debugLog = `                            // 디버깅 로그
                            if (isAlreadyAdded) {
                              console.log(\`필터링됨: \${s.name} - 이미 추가된 직원\`)
                            }

                            return !isAlreadyAdded`;

const cleanFilter = `                            return !isAlreadyAdded`;

if (content.includes(debugLog)) {
  content = content.replace(debugLog, cleanFilter);
  console.log('✅ 디버깅 로그 제거 완료');
} else {
  console.log('ℹ️ 디버깅 로그가 없거나 이미 제거되었습니다.');
}

// 파일 저장
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ 모든 수정 완료!');
console.log('📁 파일:', filePath);
