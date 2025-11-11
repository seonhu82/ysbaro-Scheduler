# ✅ 생체인증 출퇴근 시스템 - TODO 리스트

**프로젝트**: 태블릿 지문/안면 인식 출퇴근 체크
**예상 기간**: 3-4일
**시작일**: ___________

---

## 📋 Phase 1: 데이터베이스 및 기본 구조 (0.5일)

### 1.1 Prisma 스키마 수정
- [ ] Staff 모델에 생체인증 필드 추가
  ```prisma
  biometricEnabled      Boolean  @default(false)
  biometricPublicKey    String?  @db.Text
  biometricCredentialId String?
  biometricCounter      Int      @default(0)
  biometricRegisteredAt DateTime?
  biometricDeviceType   String?
  ```
- [ ] Attendance 모델 생성
  ```prisma
  model Attendance {
    id         String           @id @default(cuid())
    clinicId   String
    staffId    String
    type       AttendanceType
    timestamp  DateTime         @default(now())
    method     AttendanceMethod
    deviceInfo String?
    location   String?

    clinic     Clinic  @relation(fields: [clinicId], references: [id])
    staff      Staff   @relation(fields: [staffId], references: [id])
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
- [ ] Migration 생성
  ```bash
  npx prisma migrate dev --name add_biometric_attendance
  ```
- [ ] Prisma Client 재생성
  ```bash
  npx prisma generate
  ```

### 1.2 타입 정의
- [ ] `src/types/attendance.ts` 생성
  ```typescript
  export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT'
  export type AttendanceMethod = 'BIOMETRIC' | 'PIN' | 'QR' | 'MANUAL'

  export interface AttendanceRecord {
    id: string
    staffId: string
    staffName: string
    type: AttendanceType
    timestamp: Date
    method: AttendanceMethod
  }
  ```
- [ ] `src/types/biometric.ts` 생성
  ```typescript
  export interface BiometricCredential {
    id: string
    publicKey: string
    counter: number
  }

  export interface BiometricRegistrationRequest {
    staffId: string
    challenge: string
  }

  export interface BiometricAuthenticationRequest {
    staffId: string
    challenge: string
    credential: any
  }
  ```

### 1.3 기본 서비스 파일 생성
- [ ] `src/lib/services/biometric-service.ts` 생성 (기본 구조만)
- [ ] `src/lib/services/attendance-service.ts` 생성 (기본 구조만)

**완료 기준**:
- ✅ DB Migration 성공
- ✅ 타입 정의 완료
- ✅ 컴파일 에러 없음

---

## 📋 Phase 2: 생체인증 등록 시스템 (1일)

### 2.1 관리자 - 직원 목록 수정
- [ ] `src/app/(dashboard)/settings/staff/page.tsx` 수정
  - [ ] 생체인증 상태 컬럼 추가
  - [ ] "생체인증 등록" 버튼 추가
  - [ ] 등록/미등록 배지 표시

### 2.2 생체인증 등록 API
- [ ] `src/app/api/biometric/register/challenge/route.ts` 생성
  - [ ] GET: Challenge 생성 및 반환
  ```typescript
  export async function GET(request: NextRequest) {
    // 1. 랜덤 challenge 생성
    // 2. 세션/DB에 임시 저장
    // 3. 반환
  }
  ```

- [ ] `src/app/api/biometric/register/verify/route.ts` 생성
  - [ ] POST: 등록 데이터 검증 및 저장
  ```typescript
  export async function POST(request: NextRequest) {
    // 1. 클라이언트 데이터 받기
    // 2. Challenge 검증
    // 3. 공개키 저장
    // 4. Staff 테이블 업데이트
  }
  ```

- [ ] `src/app/api/biometric/unregister/route.ts` 생성
  - [ ] DELETE: 생체인증 등록 해제
  ```typescript
  export async function DELETE(request: NextRequest) {
    // 1. staffId 확인
    // 2. 생체인증 정보 삭제
    // 3. Staff 테이블 업데이트
  }
  ```

### 2.3 생체인증 등록 페이지
- [ ] `src/app/(dashboard)/settings/staff/biometric/[staffId]/page.tsx` 생성
  - [ ] 직원 정보 표시
  - [ ] WebAuthn 등록 버튼
  - [ ] 등록 진행 상태 표시
  - [ ] 성공/실패 피드백

### 2.4 생체인증 서비스 구현
- [ ] `src/lib/services/biometric-service.ts` 완성
  ```typescript
  // 등록 관련
  export async function generateChallenge()
  export async function verifyRegistration()
  export async function storeCredential()

  // 인증 관련
  export async function verifyAuthentication()
  export async function getCredential()
  ```

### 2.5 클라이언트 WebAuthn 유틸
- [ ] `src/lib/utils/webauthn-client.ts` 생성
  ```typescript
  export async function registerBiometric(challenge: string)
  export async function authenticateBiometric(challenge: string)
  export function isBiometricAvailable()
  ```

**완료 기준**:
- ✅ 관리자가 직원 생체인증 등록 가능
- ✅ 공개키가 DB에 저장됨
- ✅ 등록 해제 가능

---

## 📋 Phase 3: 태블릿 출퇴근 페이지 (1일)

### 3.1 태블릿 레이아웃
- [ ] `src/app/(tablet)/layout.tsx` 생성
  - [ ] 전체 화면 레이아웃
  - [ ] 헤더 (시간, 날짜 표시)
  - [ ] 반응형 디자인 (태블릿 최적화)

### 3.2 메인 출퇴근 페이지
- [ ] `src/app/(tablet)/attendance/page.tsx` 생성
  - [ ] 직원 선택 UI
  - [ ] 검색 기능
  - [ ] 상태: 선택 대기 → 인증 → 출퇴근 선택

### 3.3 컴포넌트 생성
- [ ] `src/components/tablet/StaffSelector.tsx`
  - [ ] 직원 그리드 표시
  - [ ] 검색 필터
  - [ ] 부서별 필터 (선택)

- [ ] `src/components/tablet/BiometricAuth.tsx`
  - [ ] WebAuthn 인증 트리거
  - [ ] 로딩 상태 표시
  - [ ] 실패 시 PIN 옵션

- [ ] `src/components/tablet/AttendanceButton.tsx`
  - [ ] 출근/퇴근 버튼
  - [ ] 현재 시간 표시
  - [ ] 오늘 기록 표시

- [ ] `src/components/tablet/SuccessAnimation.tsx`
  - [ ] 성공 애니메이션
  - [ ] 3초 후 자동 리셋

### 3.4 출퇴근 기록 API
- [ ] `src/app/api/attendance/check-in/route.ts` 생성
  ```typescript
  export async function POST(request: NextRequest) {
    // 1. 인증 정보 검증
    // 2. 중복 체크 (오늘 이미 출근했는지)
    // 3. Attendance 레코드 생성
    // 4. 성공 응답
  }
  ```

- [ ] `src/app/api/attendance/check-out/route.ts` 생성
  ```typescript
  export async function POST(request: NextRequest) {
    // 1. 인증 정보 검증
    // 2. 출근 기록 확인 (퇴근 전 출근 필수)
    // 3. Attendance 레코드 생성
    // 4. 성공 응답
  }
  ```

- [ ] `src/app/api/attendance/today/[staffId]/route.ts` 생성
  ```typescript
  export async function GET(request: NextRequest) {
    // 1. 오늘 날짜의 출퇴근 기록 조회
    // 2. 반환
  }
  ```

### 3.5 생체인증 플로우
- [ ] 인증 Challenge API
  - [ ] `src/app/api/biometric/auth/challenge/route.ts`

- [ ] 인증 검증 API
  - [ ] `src/app/api/biometric/auth/verify/route.ts`

### 3.6 백업 인증 (PIN)
- [ ] PIN 입력 모달 컴포넌트
- [ ] PIN 검증 로직

**완료 기준**:
- ✅ 태블릿에서 직원 선택 가능
- ✅ 생체인식으로 출근 체크 성공
- ✅ 생체인식으로 퇴근 체크 성공
- ✅ 실패 시 PIN 인증 가능

---

## 📋 Phase 4: 관리자 기록 조회 (0.5일)

### 4.1 출퇴근 기록 페이지
- [ ] `src/app/(dashboard)/attendance/page.tsx` 생성
  - [ ] 날짜 범위 선택
  - [ ] 직원 필터
  - [ ] 기록 테이블
  - [ ] 페이지네이션

### 4.2 기록 조회 API
- [ ] `src/app/api/attendance/records/route.ts`
  ```typescript
  export async function GET(request: NextRequest) {
    // Query params: startDate, endDate, staffId, page, limit
    // 1. 필터링된 기록 조회
    // 2. 페이지네이션 적용
    // 3. 반환
  }
  ```

### 4.3 통계 API
- [ ] `src/app/api/attendance/statistics/route.ts`
  ```typescript
  export async function GET(request: NextRequest) {
    // 1. 기간별 통계
    // 2. 직원별 통계
    // 3. 지각/조퇴 통계
  }
  ```

### 4.4 엑셀 다운로드 (선택)
- [ ] 엑셀 export 기능
- [ ] CSV 다운로드

**완료 기준**:
- ✅ 관리자가 출퇴근 기록 조회 가능
- ✅ 날짜/직원 필터 작동
- ✅ 통계 표시

---

## 📋 Phase 5: 테스트 및 안정화 (0.5일)

### 5.1 기능 테스트
- [ ] 생체인증 등록 테스트
  - [ ] 지문 등록 성공
  - [ ] 안면인식 등록 성공
  - [ ] 등록 실패 처리

- [ ] 출퇴근 체크 테스트
  - [ ] 출근 성공
  - [ ] 퇴근 성공
  - [ ] 중복 체크 방지
  - [ ] 순서 검증 (출근 후 퇴근)

- [ ] 여러 기기 테스트
  - [ ] 태블릿 1에서 등록
  - [ ] 태블릿 2에서 인증

- [ ] 백업 인증 테스트
  - [ ] 생체인식 실패 시 PIN
  - [ ] PIN 인증 성공

### 5.2 에러 처리
- [ ] 네트워크 오류 처리
- [ ] 브라우저 미지원 처리
- [ ] 생체인식 센서 없음 처리

### 5.3 보안 검토
- [ ] Challenge 재사용 방지
- [ ] HTTPS 필수 확인
- [ ] 타임스탬프 검증
- [ ] Rate limiting 고려

### 5.4 문서화
- [ ] API 문서 작성
- [ ] 사용자 매뉴얼
- [ ] 관리자 가이드

**완료 기준**:
- ✅ 모든 기능 정상 작동
- ✅ 에러 처리 완료
- ✅ 보안 검토 통과
- ✅ 문서 완성

---

## 📋 추가 작업 (선택)

### 위치 기반 체크 (선택)
- [ ] GPS 위치 확인
- [ ] 허용 범위 설정
- [ ] 위치 이탈 경고

### 사진 촬영 (선택)
- [ ] 출퇴근 시 사진 촬영
- [ ] 사진 저장 및 조회

### 알림 기능 (선택)
- [ ] 출퇴근 완료 알림
- [ ] 관리자 알림

---

## 🔧 개발 환경 설정

### 필수 도구
- [ ] Node.js 18+
- [ ] HTTPS 로컬 개발 환경
  ```bash
  # mkcert 설치 (로컬 HTTPS)
  npm install -g mkcert
  mkcert create-ca
  mkcert create-cert
  ```

### 브라우저 설정
- [ ] Chrome DevTools 생체인식 시뮬레이터 확인
- [ ] 실제 기기 테스트 환경 준비

---

## 📊 진행 상황 추적

### Phase 1: DB & 기본 구조
- 진행률: 0%
- 예상: 0.5일
- 실제: ___일
- 상태: [ ] 진행 전 [ ] 진행 중 [ ] 완료

### Phase 2: 생체인증 등록
- 진행률: 0%
- 예상: 1일
- 실제: ___일
- 상태: [ ] 진행 전 [ ] 진행 중 [ ] 완료

### Phase 3: 태블릿 출퇴근
- 진행률: 0%
- 예상: 1일
- 실제: ___일
- 상태: [ ] 진행 전 [ ] 진행 중 [ ] 완료

### Phase 4: 관리자 조회
- 진행률: 0%
- 예상: 0.5일
- 실제: ___일
- 상태: [ ] 진행 전 [ ] 진행 중 [ ] 완료

### Phase 5: 테스트
- 진행률: 0%
- 예상: 0.5일
- 실제: ___일
- 상태: [ ] 진행 전 [ ] 진행 중 [ ] 완료

**전체 진행률**: 0% (0/50+ 작업)

---

## 🐛 이슈 트래킹

### 발견된 버그
1.

2.

3.

### 기술적 문제
1.

2.

---

## 💡 개선 아이디어
1.

2.

3.

---

## ✅ 최종 체크리스트

### 배포 전 확인
- [ ] 모든 Phase 완료
- [ ] 테스트 통과
- [ ] 보안 검토 완료
- [ ] 문서 작성 완료
- [ ] 개인정보 동의서 준비
- [ ] 백업 계획 수립

### 배포 준비
- [ ] 프로덕션 빌드 테스트
- [ ] 데이터베이스 백업
- [ ] Migration 스크립트 준비
- [ ] 롤백 계획 수립

### 사용자 준비
- [ ] 태블릿 구매 및 설치
- [ ] 직원 교육 자료
- [ ] 관리자 교육
- [ ] 공지사항 발송

---

**시작일**: ___________
**완료일**: ___________
**총 소요시간**: ___________

**참고 문서**:
- BIOMETRIC-ATTENDANCE-PLAN.md (전체 계획)
- WebAuthn 가이드
- Prisma 문서
