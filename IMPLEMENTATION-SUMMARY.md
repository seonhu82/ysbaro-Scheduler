# 연차/오프 신청 동적 제한 시스템 - 구현 요약

## 🎯 구현 완료 항목

### ✅ Phase 0: 신청 페이지 UI 개선 (이미 완료됨)
- 자동 배치 시스템 안내 문구
- 실시간 통계 표시 (현재 신청 / 예상 OFF / 자동 배치)
- 권장 사항 가이드라인 (good/warning/critical)

### ✅ Phase 1: 제약 조건 시뮬레이션 엔진
**파일**: `src/lib/services/leave-eligibility-simulator.ts`

**기능**:
- 주4일 제약 검증 (공휴일 고려)
- 구분별 필수 인원 검증 (flexible staff 고려)
- 편차 허용 범위 검증 (확장 가능)

### ✅ Phase 2: 사용자 친화적 메시지 빌더
**파일**: `src/lib/services/leave-rejection-message-builder.ts`

**기능**:
- 시뮬레이션 결과를 사용자가 이해할 수 있는 언어로 변환
- 구체적인 이유와 대안 제시
- 자동 배치 우선 원칙 강조

### ✅ Phase 3: 신청 API 통합
**파일**: `src/app/api/leave-apply/[token]/submit-v3/route.ts`

**기능**:
- 신청 전 시뮬레이션 검증
- 실패 시 상세한 거절 메시지 반환
- 성공 시 자동 배치 안내 메시지

### ✅ Phase 4: 프론트엔드 통합
**파일**: `src/app/(public)/leave-apply/[token]/page.tsx`

**변경사항**:
- submit-v3 API 사용
- 에러 메시지 표시 개선 (제목 + 메시지 + 제안)

## 📦 생성된 파일

### 새로 생성된 파일 (3개)
1. `src/lib/services/leave-eligibility-simulator.ts` - 시뮬레이션 엔진
2. `src/lib/services/leave-rejection-message-builder.ts` - 메시지 빌더
3. `src/app/api/leave-apply/[token]/submit-v3/route.ts` - 동적 제한 API

### 수정된 파일 (1개)
1. `src/app/(public)/leave-apply/[token]/page.tsx` - submit-v3 사용

### 문서 및 테스트 (3개)
1. `DYNAMIC-RESTRICTION-SYSTEM.md` - 전체 시스템 문서
2. `test-dynamic-restriction.js` - 테스트 스크립트
3. `update-submit-api.js` - 프론트엔드 업데이트 스크립트

## 🔑 핵심 기능

### 1. 주4일 제약 검증
```typescript
// 해당 주의 근무일 계산 (일~토)
// 공휴일 제외
// 연차는 근무일로 계산
// 최소 근무일 = 4 - 공휴일 수
```

**검증 로직**:
- 주의 시작(일요일)과 종료(토요일) 계산
- 현재 배치된 근무일 수 조회
- 승인된 연차 조회 (연차 = 근무일)
- 신청 날짜 OFF 시 근무일이 최소 기준 미달이면 거절

### 2. 구분별 필수 인원 검증
```typescript
// 해당 날짜의 필요 인원 조회
// 신청자 제외 시 가용 인원 확인
// Flexible staff 고려
```

**검증 로직**:
- 직원의 구분(categoryName) 조회
- DailySlot에서 해당 날짜 필요 인원 계산
- 같은 구분의 가용 직원 수 조회
- Flexible staff 추가 확인
- 총 가용 인원 < 필요 인원이면 거절

### 3. 사용자 친화적 메시지
```typescript
interface RejectionMessage {
  title: string         // "주간 근무일 부족"
  message: string       // "해당 주(2/11~2/17)에..."
  suggestion: string    // "자동 배치에 맡겨주세요"
  icon: 'warning' | 'info' | 'error'
}
```

## 📊 API 응답 형식

### 성공 응답
```json
{
  "success": true,
  "application": { ... },
  "status": "PENDING",
  "message": "신청이 완료되었습니다. 나머지 OFF는 자동 배치 시스템이 형평성을 고려하여 배정합니다."
}
```

### 거절 응답
```json
{
  "success": false,
  "error": "이 날짜는 실팀장급 4명이 필요하지만...",
  "title": "인원 부족으로 자동 배치가 어렵습니다",
  "suggestion": "꼭 필요한 날짜가 아니라면 자동 배치로...",
  "technicalReason": "실팀장급은 최소 4명 필요하지만, 귀하 제외 시 3명만 가능합니다.",
  "reason": "CATEGORY_SHORTAGE",
  "details": {
    "categoryShortage": {
      "category": "실팀장급",
      "required": 4,
      "available": 3
    }
  },
  "userMessage": {
    "title": "인원 부족으로 자동 배치가 어렵습니다",
    "message": "이 날짜는 실팀장급 4명이 필요하지만...",
    "suggestion": "꼭 필요한 날짜가 아니라면 자동 배치로...",
    "icon": "warning"
  }
}
```

## 🚀 배포 방법

### 1. 빌드 테스트
```bash
npm run build
```

### 2. 타입 체크
```bash
npx tsc --noEmit
```

### 3. 테스트 실행 (선택)
```bash
node test-dynamic-restriction.js
```

### 4. 서버 재시작
```bash
# 개발 서버
npm run dev

# 프로덕션
npm run start
```

## 🎯 사용자 경험 개선

### Before (기존)
1. 신청 → 형평성 검증 실패 → "형평성 점수가 부족합니다"
2. 이유를 모름
3. 대안을 모름
4. 과도한 신청 방지 불가

### After (개선)
1. 신청 → **시뮬레이션 검증** → 거절 시 상세 이유 제공
2. "이 날짜는 실팀장급 4명이 필요하지만, 귀하 제외 시 3명만 가능합니다"
3. "자동 배치에 맡기시면 시스템이 최적의 OFF를 배정해드립니다"
4. 실시간 통계로 적절한 신청 수준 파악

## 📈 기대 효과

### 1. 스케줄 생성 안정성 향상
- 배치 불가능한 신청을 사전에 차단
- 자동 배치 실패율 감소

### 2. 직원 만족도 향상
- 거절 이유를 명확히 이해
- 대안을 제시받음
- 자동 배치 시스템에 대한 신뢰도 향상

### 3. 관리자 부담 감소
- 불가능한 신청 감소
- 문의 대응 시간 단축

## 🔧 유지보수 가이드

### 제약 조건 추가 방법

1. **시뮬레이터에 검증 함수 추가**
```typescript
// src/lib/services/leave-eligibility-simulator.ts
async function checkNewConstraint() {
  // 새로운 제약 조건 검증 로직
  return { allowed: true }
}
```

2. **메시지 빌더에 메시지 추가**
```typescript
// src/lib/services/leave-rejection-message-builder.ts
function buildNewConstraintMessage(result: SimulationResult) {
  return {
    title: '새 제약 조건 위반',
    message: '상세 설명...',
    suggestion: '대안 제시...'
  }
}
```

3. **시뮬레이터 메인 함수에 통합**
```typescript
const newCheck = await checkNewConstraint()
if (!newCheck.allowed) {
  return { feasible: false, reason: 'NEW_CONSTRAINT' }
}
```

## 📝 다음 단계 (선택적)

### Phase 5: 고급 기능 (우선순위 낮음)
1. [ ] 대안 날짜 추천 알고리즘
2. [ ] 편차 정보 상세 표시
3. [ ] 과거 승인률 통계
4. [ ] 관리자 대시보드
5. [ ] 캐싱 전략 구현
6. [ ] 성능 모니터링

## ✅ 완료 확인

- [x] 모든 Phase 구현 완료
- [x] TypeScript 컴파일 검증
- [x] API 엔드포인트 통합
- [x] 프론트엔드 업데이트
- [x] 문서화 완료
- [x] 테스트 스크립트 작성

## 🎉 결론

연차/오프 신청 동적 제한 시스템이 성공적으로 구현되었습니다!

**주요 성과**:
- ✅ 자동 배치 우선 원칙 확립
- ✅ 배치 불가능한 신청 사전 차단
- ✅ 사용자 친화적 메시지 제공
- ✅ 실시간 통계로 과도한 신청 방지

**다음 작업**:
1. 실제 환경에서 테스트
2. 사용자 피드백 수집
3. 필요시 메시지 조정
4. 성능 모니터링

시스템이 정상 작동하면 전체 스케줄 생성의 안정성과 형평성이 크게 향상될 것입니다!
