const fs = require('fs');

const filePath = 'src/app/api/schedule/auto-assign/route.ts';

// UTF-8로 파일 읽기
const content = fs.readFileSync(filePath, 'utf8');

// 삽입할 코드
const newCode = `    // 3. 주 근무일 설정 조회
    const ruleSettings = await prisma.ruleSettings.findUnique({
      where: { clinicId }
    })
    const weekBusinessDays = ruleSettings?.weekBusinessDays || 6 // 주 영업일 (기본값 6)
    const defaultWorkDays = ruleSettings?.defaultWorkDays || 4 // 주 근무일 (기본값 4)
    console.log(\`   ✅ 주 영업일: \${weekBusinessDays}일, 주 근무일: \${defaultWorkDays}일\`)

    // 4. 의사 조합 정보 조회`;

// 찾을 문자열
const oldCode = `    // 3. 의사 조합 정보 조회`;

// 교체
const newContent = content.replace(oldCode, newCode);

if (content === newContent) {
  console.log('❌ 변경할 부분을 찾지 못했습니다.');
  process.exit(1);
}

// UTF-8로 저장
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('✅ RuleSettings 쿼리 추가 완료!');
console.log('변경 위치: 433-439번째 줄');
