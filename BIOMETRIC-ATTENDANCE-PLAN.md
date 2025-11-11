# 🔐 생체인증 출퇴근 시스템 구현 계획

## 📋 프로젝트 개요

**목표**: 태블릿에서 지문/안면 인식으로 출퇴근 체크
**기술**: WebAuthn (Web Authentication API)
**예상 기간**: 2-3일

---

## 🎯 핵심 기능

### 1. 생체인증 등록
- 관리자 페이지에서 직원별 생체인증 등록
- 암호화된 공개키를 서버 DB에 저장
- 여러 생체정보 등록 가능 (지문 여러 개, 얼굴 등)

### 2. 태블릿 출퇴근 페이지
- 직원 선택 (이름 검색/리스트)
- 생체인식 인증
- 출근/퇴근 선택 및 기록

### 3. 백업 인증
- 생체인식 실패 시 PIN 입력 가능
- QR 코드 방식도 계속 사용 가능

---

## 🏗️ 시스템 구조

```
┌─────────────────────────────────────────┐
│          관리자 페이지                    │
│  - 직원 목록                              │
│  - 생체인증 등록 버튼                      │
│  - 등록 현황 확인                         │
└─────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │    Staff 테이블        │
         │  - biometricEnabled   │
         │  - biometricPublicKey │
         │  - biometricCredentialId │
         └──────────────────────┘
                    ↑
┌─────────────────────────────────────────┐
│      태블릿 출퇴근 페이지                  │
│  1. 직원 선택                             │
│  2. 생체인식 인증                         │
│  3. 출근/퇴근 기록                        │
└─────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │  Attendance 테이블     │
         │  - 출근/퇴근 기록       │
         └──────────────────────┘
```

---

## 📊 데이터베이스 스키마

### Staff 테이블 수정 (Prisma Schema)

```prisma
model Staff {
  id              String   @id @default(cuid())
  name            String
  clinicId        String
  // ... 기존 필드들

  // 생체인증 관련 (추가)
  biometricEnabled      Boolean  @default(false)
  biometricPublicKey    String?  @db.Text
  biometricCredentialId String?
  biometricCounter      Int      @default(0)
  biometricRegisteredAt DateTime?
  biometricDeviceType   String?  // "fingerprint", "face", etc.

  // 관계
  clinic          Clinic   @relation(fields: [clinicId], references: [id])
  attendances     Attendance[]

  @@index([clinicId])
  @@index([biometricEnabled])
}
```

### Attendance 테이블 (기존 또는 새로 생성)

```prisma
model Attendance {
  id         String   @id @default(cuid())
  clinicId   String
  staffId    String
  type       AttendanceType  // CHECK_IN, CHECK_OUT
  timestamp  DateTime @default(now())
  method     AttendanceMethod // BIOMETRIC, PIN, QR, MANUAL
  deviceInfo String?  // 사용한 기기 정보
  location   String?  // 체크 위치 (선택)

  clinic     Clinic   @relation(fields: [clinicId], references: [id])
  staff      Staff    @relation(fields: [staffId], references: [id])

  @@index([clinicId])
  @@index([staffId])
  @@index([timestamp])
}

enum AttendanceType {
  CHECK_IN
  CHECK_OUT
}

enum AttendanceMethod {
  BIOMETRIC
  PIN
  QR
  MANUAL
}
```

---

## 🔧 구현 단계

### Phase 1: 데이터베이스 및 기본 구조 (0.5일)

**1.1 Prisma 스키마 수정**
- [ ] Staff 모델에 생체인증 필드 추가
- [ ] Attendance 모델 생성 또는 수정
- [ ] Migration 생성 및 실행

**1.2 기본 타입 정의**
- [ ] `src/types/attendance.ts` 생성
- [ ] `src/types/biometric.ts` 생성

---

### Phase 2: 생체인증 등록 시스템 (1일)

**2.1 관리자 페이지 - 직원 관리**
- [ ] 직원 목록에 "생체인증 등록" 버튼 추가
- [ ] 등록 상태 표시 (등록됨/미등록)
- [ ] 등록 해제 기능

**2.2 생체인증 등록 페이지**
- [ ] `src/app/(dashboard)/staff/biometric-register/[staffId]/page.tsx`
- [ ] WebAuthn 등록 플로우
- [ ] 성공/실패 피드백

**2.3 생체인증 등록 API**
- [ ] `POST /api/biometric/register` - 등록 시작
- [ ] `POST /api/biometric/register/verify` - 등록 완료
- [ ] `DELETE /api/biometric/unregister` - 등록 해제

**파일 구조**:
```
src/
├── app/
│   ├── (dashboard)/
│   │   └── settings/
│   │       └── staff/
│   │           ├── page.tsx (수정: 생체인증 버튼 추가)
│   │           └── biometric/
│   │               └── [staffId]/
│   │                   └── page.tsx (신규)
│   └── api/
│       └── biometric/
│           ├── register/
│           │   └── route.ts (신규)
│           └── unregister/
│               └── route.ts (신규)
└── lib/
    └── services/
        └── biometric-service.ts (신규)
```

---

### Phase 3: 태블릿 출퇴근 페이지 (1일)

**3.1 출퇴근 체크 페이지**
- [ ] `src/app/(tablet)/attendance/page.tsx`
- [ ] 직원 선택 UI (그리드 또는 검색)
- [ ] 생체인식 인증 플로우
- [ ] 출근/퇴근 선택
- [ ] 성공 애니메이션

**3.2 출퇴근 기록 API**
- [ ] `POST /api/attendance/check-in` - 출근
- [ ] `POST /api/attendance/check-out` - 퇴근
- [ ] `GET /api/attendance/today` - 오늘 기록 조회

**3.3 백업 인증 (PIN)**
- [ ] 생체인식 실패 시 PIN 입력 옵션
- [ ] PIN 확인 API

**파일 구조**:
```
src/
├── app/
│   ├── (tablet)/
│   │   └── attendance/
│   │       ├── page.tsx (신규: 메인 출퇴근 페이지)
│   │       └── layout.tsx (신규: 태블릿 전용 레이아웃)
│   └── api/
│       └── attendance/
│           ├── check-in/
│           │   └── route.ts (신규)
│           ├── check-out/
│           │   └── route.ts (신규)
│           └── today/
│               └── route.ts (신규)
└── components/
    └── tablet/
        ├── StaffSelector.tsx (신규)
        ├── BiometricAuth.tsx (신규)
        ├── AttendanceButton.tsx (신규)
        └── SuccessAnimation.tsx (신규)
```

---

### Phase 4: 관리자 출퇴근 기록 조회 (0.5일)

**4.1 출퇴근 기록 페이지**
- [ ] `src/app/(dashboard)/attendance/page.tsx`
- [ ] 날짜별 기록 조회
- [ ] 직원별 필터링
- [ ] 엑셀 다운로드

**4.2 통계 API**
- [ ] `GET /api/attendance/records` - 기록 조회
- [ ] `GET /api/attendance/statistics` - 통계

---

## 🎨 UI/UX 디자인

### 태블릿 출퇴근 페이지 (메인)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           🏥 출퇴근 체크 시스템                        │
│              2025년 11월 12일 (화)                   │
│                  09:23 AM                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  직원 검색: [_______________] 🔍                     │
│                                                     │
│  ┌──────┬──────┬──────┬──────┬──────┐              │
│  │김철수 │이영희 │박민수 │최지훈 │홍길동 │              │
│  │진료실 │진료실 │원장   │실팀장 │실팀장 │              │
│  └──────┴──────┴──────┴──────┴──────┘              │
│  ┌──────┬──────┬──────┬──────┬──────┐              │
│  │김민지 │이준호 │박서연 │정우성 │송혜교 │              │
│  │진료실 │팀장   │진료실 │실팀장 │진료실 │              │
│  └──────┴──────┴──────┴──────┴──────┘              │
│                                                     │
│  [더보기 ▼]                                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 생체인식 인증 화면

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│               👤 홍길동 (실팀장급)                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│        👆 지문 센서에 손가락을 올려주세요              │
│                                                     │
│              ┌─────────────┐                        │
│              │             │                        │
│              │  [지문센서]  │                        │
│              │             │                        │
│              └─────────────┘                        │
│                                                     │
│         또는 카메라를 응시해주세요 👁️                 │
│                                                     │
│                                                     │
│         [PIN 번호로 인증] [취소]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 출근/퇴근 선택

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              ✅ 홍길동님 인증 완료                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│                                                     │
│    ┌─────────────────┐  ┌─────────────────┐        │
│    │                 │  │                 │        │
│    │      출근        │  │      퇴근        │        │
│    │                 │  │                 │        │
│    │    🌅 09:23     │  │    🌆 18:00     │        │
│    │                 │  │                 │        │
│    │   CHECK IN      │  │   CHECK OUT     │        │
│    │                 │  │                 │        │
│    └─────────────────┘  └─────────────────┘        │
│                                                     │
│                                                     │
│              오늘 출근 기록: 없음                      │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 완료 화면

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    ✅                               │
│                                                     │
│              출근이 완료되었습니다!                     │
│                                                     │
│               홍길동 (실팀장급)                        │
│              2025.11.12  09:23 AM                  │
│                                                     │
│                                                     │
│              좋은 하루 되세요! 😊                     │
│                                                     │
│                                                     │
│         (3초 후 자동으로 돌아갑니다)                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 보안 고려사항

### 1. 생체정보 보호
- ✅ 원본 생체정보는 절대 서버로 전송 안 함
- ✅ 암호화된 공개키만 저장
- ✅ HTTPS 필수

### 2. 재생 공격 방지
- ✅ Challenge-Response 방식
- ✅ Nonce 사용 (1회용 난수)
- ✅ 타임스탬프 검증

### 3. 개인정보 동의
- ✅ 생체인식 사용 동의서
- ✅ 개인정보처리방침 업데이트
- ✅ 등록 시 명시적 동의

---

## 📱 지원 디바이스

### 권장 태블릿
- ✅ iPad (Touch ID, Face ID)
- ✅ 삼성 Galaxy Tab S 시리즈 (지문인식)
- ✅ Chrome/Safari 최신 버전 필수

### 브라우저 요구사항
- Chrome 67+ (Android)
- Safari 14+ (iOS)
- Edge 18+

---

## 🧪 테스트 시나리오

### 기능 테스트
1. [ ] 생체인증 등록 성공
2. [ ] 등록 후 여러 태블릿에서 인증
3. [ ] 출근 체크 성공
4. [ ] 퇴근 체크 성공
5. [ ] 생체인식 실패 시 PIN 인증
6. [ ] 중복 출근 방지
7. [ ] 기록 조회 정상

### 에러 케이스
1. [ ] 생체인식 실패 3회
2. [ ] 이미 출근한 상태에서 재출근
3. [ ] 출근 전 퇴근 시도
4. [ ] 네트워크 오류 처리

---

## 📊 예상 일정

| Phase | 작업 | 소요시간 | 담당 |
|-------|------|---------|------|
| Phase 1 | DB 스키마 & 기본 구조 | 0.5일 | 개발자 |
| Phase 2 | 생체인증 등록 시스템 | 1일 | 개발자 |
| Phase 3 | 태블릿 출퇴근 페이지 | 1일 | 개발자 |
| Phase 4 | 관리자 기록 조회 | 0.5일 | 개발자 |
| 테스트 | 기능 테스트 & 버그 수정 | 0.5일 | 전체 |
| **총합** | | **3.5일** | |

---

## 💰 비용 산정

### 개발 비용
- ✅ 무료 (WebAuthn 표준 기술)
- ✅ 추가 라이브러리 불필요

### 하드웨어 비용
- 지문인식 태블릿 (삼성 Tab S9): 약 80-100만원 × 2대 = 160-200만원
- 또는 iPad (Touch ID): 약 60-80만원 × 2대 = 120-160만원

### 유지보수 비용
- ✅ 없음 (자체 시스템)

---

## 🚀 배포 계획

### 1단계: 개발 환경 테스트
- 로컬에서 기능 개발 및 테스트

### 2단계: 스테이징 배포
- 실제 태블릿 1대로 테스트
- 직원 5-10명 테스트 사용자

### 3단계: 프로덕션 배포
- 전체 직원 생체인증 등록
- 태블릿 2대 설치
- 1주일 병행 운영 (QR + 생체인식)

### 4단계: 전환 완료
- 생체인식으로 완전 전환
- QR 방식은 백업용으로 유지

---

## 📝 참고 문서

- [WebAuthn 가이드](https://webauthn.guide/)
- [MDN Web Authentication API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API)
- [FIDO2 표준](https://fidoalliance.org/fido2/)

---

## ✅ 완료 기준

- [ ] 관리자가 직원 생체인증 등록 가능
- [ ] 태블릿에서 지문/안면 인증 성공
- [ ] 출근/퇴근 기록 정상 저장
- [ ] 여러 태블릿에서 동일하게 작동
- [ ] PIN 백업 인증 가능
- [ ] 관리자가 기록 조회 가능
- [ ] 보안 검토 완료
- [ ] 개인정보 동의서 준비

---

**다음 단계**: TODO 리스트 생성 및 Phase 1 시작!
