/**
 * 동적 제한 시스템 테스트 스크립트
 *
 * 테스트 시나리오:
 * 1. 주4일 제약 위반 테스트
 * 2. 구분별 인원 부족 테스트
 * 3. 정상 신청 테스트
 */

const { simulateScheduleWithLeave } = require('./src/lib/services/leave-eligibility-simulator')
const { buildRejectionMessage } = require('./src/lib/services/leave-rejection-message-builder')

async function testDynamicRestriction() {
  console.log('📋 동적 제한 시스템 테스트 시작\n')

  // 테스트 케이스 1: 실제 데이터로 테스트할 경우 필요한 정보
  const testCase = {
    clinicId: 'cmh697itv0001fw83azbrqe60', // 실제 clinic ID로 변경 필요
    staffId: 'cmh697ixj0007fw83n40wq01g',   // 실제 staff ID로 변경 필요
    leaveDate: new Date('2025-02-15'),
    leaveType: 'OFF',
    year: 2025,
    month: 2
  }

  console.log('🔍 테스트 케이스:', {
    날짜: testCase.leaveDate.toISOString().split('T')[0],
    유형: testCase.leaveType,
    연월: `${testCase.year}-${testCase.month}`
  })

  try {
    console.log('\n⏳ 시뮬레이션 실행 중...\n')

    const result = await simulateScheduleWithLeave(testCase)

    console.log('📊 시뮬레이션 결과:')
    console.log('━'.repeat(50))
    console.log(`가능 여부: ${result.feasible ? '✅ 가능' : '❌ 불가능'}`)

    if (!result.feasible) {
      console.log(`실패 이유: ${result.reason}`)
      console.log(`기술적 이유: ${result.technicalReason}`)
      console.log(`사용자 메시지: ${result.userFriendlyMessage}`)

      if (result.details) {
        console.log('\n📝 상세 정보:')
        console.log(JSON.stringify(result.details, null, 2))
      }

      // 사용자 친화적 메시지 생성
      console.log('\n💬 사용자 친화적 메시지:')
      console.log('━'.repeat(50))
      const message = buildRejectionMessage(result)
      console.log(`제목: ${message.title}`)
      console.log(`메시지: ${message.message}`)
      console.log(`제안: ${message.suggestion}`)
      console.log(`아이콘: ${message.icon}`)
    } else {
      console.log('✅ 신청 가능: 모든 제약 조건 통과')
    }

    console.log('━'.repeat(50))

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    console.error(error.stack)
  }
}

// 비동기 함수 실행
testDynamicRestriction()
  .then(() => {
    console.log('\n✅ 테스트 완료')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 테스트 오류:', error)
    process.exit(1)
  })
