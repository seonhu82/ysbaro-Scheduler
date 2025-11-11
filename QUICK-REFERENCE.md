# ⚡ 빠른 참조 가이드 - 동적 제한 시스템

## 🚀 빠른 시작

```bash
# 서버 시작
npm run dev

# 테스트 페이지 접속
http://localhost:3000/leave-apply/[TOKEN]
```

---

## 📂 주요 파일 위치

```
src/lib/services/
├── leave-eligibility-simulator.ts      ⭐ 시뮬레이션 엔진
└── leave-rejection-message-builder.ts  ⭐ 메시지 빌더

src/app/api/leave-apply/[token]/
├── submit-v3/route.ts                   ⭐ 동적 제한 API
└── statistics/route.ts                  📊 통계 API

src/app/(public)/leave-apply/[token]/
└── page.tsx                             🎨 신청 페이지
```

---

## 🔍 콘솔 로그 확인

### 정상 통과
```
🔍 [동적 제한] 시뮬레이션 시작: 홍길동 - 2025-02-15 (OFF)
✅ [동적 제한] 시뮬레이션 통과: 자동 배치 가능
✅ [동적 제한] 신청 완료: 홍길동 (2025-02-15) - PENDING
```

### 거절 (주4일 위반)
```
🔍 [동적 제한] 시뮬레이션 시작: 홍길동 - 2025-02-15 (OFF)
❌ [동적 제한] 시뮬레이션 실패: WEEK_4DAY_VIOLATION
```

### 거절 (인원 부족)
```
🔍 [동적 제한] 시뮬레이션 시작: 홍길동 - 2025-02-15 (OFF)
❌ [동적 제한] 시뮬레이션 실패: CATEGORY_SHORTAGE
```

---

## 🧪 테스트 시나리오

### ✅ 정상 케이스
1. 인증
2. 가능한 날짜 선택
3. 신청 → **성공**

### ❌ 주4일 위반
1. 한 주에 이미 여러 날 신청
2. 추가 신청 → **거절**
3. 메시지: "주간 근무일 부족"

### ❌ 인원 부족
1. 같은 구분 많이 신청된 날
2. 추가 신청 → **거절**
3. 메시지: "인원 부족으로..."

---

## 📊 API 엔드포인트

### 신청 API
```
POST /api/leave-apply/[token]/submit-v3
Body: { date, type, pin }
```

### 통계 API
```
GET /api/leave-apply/[token]/statistics?staffId=xxx
```

---

## 🎯 검증 제약 조건

1. **주4일 제약**
   - 주 범위: 일~토
   - 공휴일 제외
   - 연차 = 근무일

2. **구분별 인원**
   - 필요 인원 계산
   - Flexible staff 고려
   - 가용 인원 확인

3. **편차 범위**
   - ±3.0 상한선
   - 현재는 통과 처리

---

## 🐛 빠른 디버깅

### 서버가 안 켜짐
```bash
npx tsc --noEmit
```

### 시뮬레이션이 항상 통과
- DailySlot 생성 확인
- 직원 배치 확인
- 콘솔 로그 확인

### 에러 메시지 안 보임
- 브라우저 콘솔 확인
- Network 탭 확인
- userMessage 필드 확인

---

## 📋 거절 이유 타입

| reason | 제목 | 설명 |
|--------|------|------|
| WEEK_4DAY_VIOLATION | 주간 근무일 부족 | 주4일 미만 |
| CATEGORY_SHORTAGE | 인원 부족 | 구분별 인원 미달 |
| FAIRNESS_EXCEEDED | 형평성 문제 | 편차 초과 |
| NO_SCHEDULE | 스케줄 미생성 | DailySlot 없음 |

---

## 🎨 UI 요소

### 안내 박스
```
📌 연차/오프 신청 안내
✓ 꼭 필요한 날짜만 신청
✓ 나머지는 자동 배치
✓ 과도한 신청은 전체 스케줄 방해
```

### 통계 카드
```
┌──────────────┬──────────────┐
│  2 / 10일    │    8일        │
│ 신청 / 예상   │  자동 배치     │
└──────────────┴──────────────┘
```

### 가이드라인 상태
- 🟢 **good**: ≤ 30%
- 🟡 **warning**: 30~60%
- 🔴 **critical**: > 60%

---

## 📞 문제 발생 시

1. **콘솔 로그 확인**
2. **Network 탭 확인**
3. **다음 정보 준비**:
   - 에러 메시지
   - 재현 방법
   - 스크린샷

---

## 📚 상세 문서

- **TOMORROW-TASK-GUIDE.md** - 상세 테스트 가이드
- **TEST-CHECKLIST.md** - 테스트 체크리스트
- **DYNAMIC-RESTRICTION-SYSTEM.md** - 전체 시스템 문서
- **IMPLEMENTATION-SUMMARY.md** - 구현 요약

---

## ✅ 핵심 체크 포인트

- [ ] 서버 정상 시작
- [ ] 페이지 로드
- [ ] 안내 문구 표시
- [ ] 통계 표시
- [ ] 정상 신청 성공
- [ ] 주4일 위반 거절
- [ ] 인원 부족 거절
- [ ] 에러 메시지 표시

---

**테스트 화이팅! 🚀**
