# 연세바로치과 스케줄 관리 시스템

> 🏥 AI 기반 치과 직원 스케줄 자동 배치 및 종합 관리 시스템

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)](https://www.prisma.io/)

## 🎯 프로젝트 소개

연세바로치과 스케줄 관리 시스템은 치과의 복잡한 직원 스케줄링을 자동화하고, 연차 관리, 출퇴근 관리, 형평성 분석 등을 통합적으로 제공하는 웹 기반 관리 시스템입니다.

### ✨ 핵심 특징

- **🤖 AI 기반 자동 배치**: 형평성과 규칙을 고려한 지능형 스케줄 생성
- **📊 부서별/구분별 세부 관리**: 팀장, 고년차, 중간년차, 저년차 등 세밀한 배치
- **⚖️ 완벽한 형평성**: 야간, 주말, 공휴일 근무의 공정한 분배 (가중치 시스템)
- **📅 연차 관리 자동화**: 신청 기간, 슬롯 제한, 자동 알림
- **📱 QR 코드 출퇴근**: 스마트폰으로 간편한 출퇴근 체크
- **🔔 실시간 알림**: SSE 기반 실시간 알림 + 이메일 통합
- **📈 고급 통계**: 차트, 엑셀/PDF 리포트

## 🚀 빠른 시작

### 사전 요구사항

- Node.js 18 이상
- PostgreSQL 14 이상
- npm 또는 yarn

### 설치

```bash
# 1. 저장소 클론
git clone <repository-url>
cd 연세바로치과-스케줄러

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어 필요한 값 설정

# 4. 데이터베이스 마이그레이션
npx prisma migrate dev

# 5. Prisma Client 생성
npx prisma generate
```

### 실행

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 🔧 환경 변수 설정

`.env.local` 파일에 다음 변수를 설정하세요:

```env
# 데이터베이스
DATABASE_URL="postgresql://username:password@localhost:5432/dental_scheduler"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# 이메일 (선택사항)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
EMAIL_FROM="noreply@yourdental.com"
```

## 📖 초기 설정 가이드

### 1. 최초 접속

```
http://localhost:3000/setup/initial
```

### 2. 5단계 초기 설정

1. **병원 정보**: 병원 이름, 주소, 연락처
2. **부서 및 구분**: 부서(데스크, 진료실 등), 구분(팀장, 고년차 등)
3. **원장 등록**: 원장 정보 입력
4. **직원 등록**: 직원 정보 및 근무 형태 설정
5. **의사 조합**: 요일별 조합 및 부서별/구분별 필요 인원 설정

## ✨ 주요 기능

### 1. 스케줄 관리
- **주간 자동 배치**: 의사 조합과 직원 특성을 고려한 AI 배치
- **부서별/구분별 배치**:
  - 필수 인원 보장 (minRequired)
  - 부족 시 다른 부서에서 유연하게 차출
- **형평성 기반 배치**: 가중치 시스템
  - 야간 근무 (기본 1.5배)
  - 주말 근무 (기본 1.0배)
  - 공휴일 근무 (기본 2.0배)

### 2. 연차 관리
- **신청 기간 관리**: 월별 연차 신청 기간 설정
- **슬롯 제한**: 일별 최대 연차/오프 수 제한
- **이메일 알림**:
  - 신청 기간 시작 알림
  - 승인/거절 알림

### 3. 출퇴근 관리
- **QR 코드 체크**: 스마트폰으로 간편 출퇴근
- **의심 기록 탐지**: 비정상 패턴 자동 감지
- **관리자 알림**: 의심 기록 발생 시 이메일 알림

### 4. 통계 및 리포트
- **시각화 대시보드**:
  - 파이 차트 (스케줄 상태)
  - 바 차트 (연차 신청)
  - 라인 차트 (월별 추이)
- **다차원 통계**:
  - 직원별 상세
  - 부서별 집계
  - 구분별 집계
- **리포트 다운로드**:
  - 엑셀 (5개 시트)
  - PDF (자동 표 생성)

### 5. 형평성 관리
- **가중치 설정**: 근무 유형별 중요도 조정 (0~3.0)
- **임계값 설정**: 허용 가능한 차이 범위 (5%~50%)
- **실시간 모니터링**: 현재 형평성 점수 확인

## 🛠 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **State**: Zustand

### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: NextAuth.js v5 (Beta)

### 기타
- **Email**: Nodemailer
- **QR Code**: qrcode
- **Excel**: XLSX
- **PDF**: jsPDF + jspdf-autotable
- **Date**: date-fns
- **Validation**: Zod

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/              # 인증 관련 페이지
│   ├── (dashboard)/         # 메인 대시보드
│   │   ├── schedule/        # 스케줄 관리
│   │   ├── leave-management/# 연차 관리
│   │   ├── statistics/      # 통계
│   │   ├── attendance/      # 출퇴근
│   │   ├── settings/        # 설정
│   │   └── setup/           # 초기 설정
│   └── api/                 # API 라우트
├── components/              # React 컴포넌트
│   ├── ui/                  # shadcn/ui
│   ├── schedule/
│   └── ...
├── lib/                     # 유틸리티 및 서비스
│   ├── algorithms/          # 배치 알고리즘
│   ├── services/            # 서비스 레이어
│   └── utils/
└── prisma/
    ├── schema.prisma        # 데이터베이스 스키마
    └── migrations/          # 마이그레이션
```

## 🔑 핵심 알고리즘

### 주간 자동 배치 (`weekly-assign-v2.ts`)

```typescript
1. 직원 풀 구성
   - 4주 근무: 매주 포함
   - 5주 근무: 5주 주기 확인

2. 부서별/구분별 배치
   - 필수 인원(minRequired) 먼저 배치
   - 부족 시 다른 부서에서 차출

3. 형평성 기반 정렬
   - 가중치 적용 점수 계산
   - 점수가 낮은 직원 우선 배치

4. 규칙 검증
   - 연속 근무 제한
   - 연차 충돌 확인
   - 부서별 최소 인원 확인
```

## 📊 데이터베이스 주요 테이블

- **Clinic**: 병원 정보
- **Staff**: 직원 정보
- **Doctor**: 원장 정보
- **DoctorCombination**: 의사 조합
- **Schedule**: 스케줄
- **StaffAssignment**: 스케줄-직원 배정
- **LeaveApplication**: 연차 신청
- **FairnessScore**: 형평성 점수
- **AttendanceRecord**: 출퇴근 기록

## 📝 스크립트

```bash
# 개발
npm run dev                 # 개발 서버
npm run build               # 프로덕션 빌드
npm start                   # 프로덕션 서버

# Prisma
npm run prisma:generate     # Client 생성
npm run prisma:migrate      # 마이그레이션
npm run prisma:studio       # Studio 실행

# 테스트
npm test                    # 테스트 실행
npm run test:watch          # Watch 모드
```

## 💡 사용 팁

### 주간 스케줄 생성
1. `/schedule` 접속
2. 연도/월 선택
3. "주간 자동 배치" 클릭
4. 검증 후 확정

### 연차 신청 기간 설정
1. `/leave-management/period-setup` 접속
2. 월별 신청 기간 설정
3. 슬롯 설정
4. 저장

### 통계 확인
1. `/statistics` 접속
2. 연도/월 선택
3. 엑셀 또는 PDF 다운로드

### 형평성 조정
1. `/settings/fairness` 접속
2. 가중치 조정 (슬라이더)
3. 임계값 설정
4. 저장

## 🤝 기여

버그 리포트, 기능 제안, PR은 언제나 환영합니다!

## 📄 라이선스

Private - 연세바로치과 전용

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

---

**Made with ❤️ by Claude Code**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
