// API 응답 테스트 - departmentName이 포함되는지 확인
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('\n=== API 응답 테스트 시작 ===\n');

    const response = await fetch('http://localhost:3000/api/schedule/day?date=2025-10-14&year=2025&month=10&status=DRAFT', {
      headers: {
        'Cookie': 'authjs.session-token=your-token-here' // 실제 토큰 필요
      }
    });

    const data = await response.json();

    console.log('API 응답 성공:', response.ok);
    console.log('\n근무 직원 샘플 (첫 3명):');

    if (data.success && data.data && data.data.staff) {
      const staff = data.data.staff.slice(0, 3);
      staff.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name}`);
        console.log(`   - categoryName: ${s.categoryName}`);
        console.log(`   - departmentName: ${s.departmentName || '❌ 없음!'}`);
        console.log(`   - rank: ${s.rank}`);
      });

      const hasDepartmentName = staff.every(s => s.departmentName);
      console.log(`\n✅ departmentName 포함 여부: ${hasDepartmentName ? '있음' : '❌ 없음'}`);
    } else {
      console.log('❌ 데이터가 없거나 형식이 잘못됨');
    }

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

testAPI();
