# 연세바로치과 스케줄 관리 시스템

치과 직원 스케줄 자동 배치 및 연차/오프 관리 시스템

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 열어서 DATABASE_URL과 NEXTAUTH_SECRET을 설정하세요
```

### 2. 데이터베이스 설정

```bash
# Prisma 마이그레이션
npm run prisma:migrate

# Seed 데이터 삽입
npm run prisma:seed

# Prisma Studio 실행 (선택사항)
npm run prisma:studio
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어보세요.

### 기본 관리자 계정
- **이메일**: admin@dental.com
- **비밀번호**: admin123!

## 📁 프로젝트 구조

```
dental-scheduler/
├── .claude/                    # Claude Code 개발 가이드
├── docs/                       # 기획 문서
├── prisma/                     # Prisma 스키마 및 마이그레이션
├── public/                     # 정적 파일
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (auth)/            # 인증 페이지
│   │   ├── (dashboard)/       # 대시보드 페이지
│   │   ├── (public)/          # 공개 페이지
│   │   └── api/               # API 라우트
│   ├── components/            # React 컴포넌트
│   ├── lib/                   # 라이브러리 및 유틸리티
│   ├── types/                 # TypeScript 타입 정의
│   └── styles/                # 스타일
└── __tests__/                 # 테스트

총 185개 파일
```

## 🎯 핵심 기능

1. **원장 요일별 패턴 관리** - 요일별 근무 패턴 저장 및 월간 일괄 적용
2. **연차/오프 신청 시스템** - 직원용 외부 링크, 실시간 슬롯 현황, 주 2일 오프 제한
3. **연차 관리 대시보드** - 달력뷰/목록뷰/직원별뷰, 신청 확정/취소
4. **월간/주간 자동 배치** - 비율 기반 배치, 형평성 고려
5. **실시간 알림** - Server-Sent Events 기반
6. **형평성 관리** - 야간/주말 근무 균형 추적
7. **스케줄 배포** - 외부 확인 링크 생성

## 🛠️ 기술 스택

- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **데이터베이스**: PostgreSQL + Prisma ORM
- **인증**: NextAuth.js v5
- **상태 관리**: Zustand + React Query
- **스타일링**: Tailwind CSS + shadcn/ui
- **배포**: Vercel

## 📚 개발 가이드

개발을 시작하기 전에 `.claude/` 디렉토리의 문서를 읽어보세요:

1. **00_프로젝트_마스터_플랜.md** - 전체 프로젝트 계획
2. **01_개발_체크리스트.md** - 파일별 작업 목록
3. **02_코딩_컨벤션.md** - 코딩 규칙

또는 `작업_시작_가이드.md`를 확인하세요.

## 📝 스크립트

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 린트
npm run lint

# Prisma 클라이언트 생성
npm run prisma:generate

# 마이그레이션
npm run prisma:migrate

# Seed 데이터 삽입
npm run prisma:seed

# Prisma Studio
npm run prisma:studio

# 테스트
npm test
npm run test:watch
```

## 🔒 환경 변수

`.env.local` 파일에 다음 변수들을 설정하세요:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
```

## 📋 개발 로드맵

- **Phase 1 (Week 1-2)**: 기초 설정 - 25개 파일
- **Phase 2 (Week 3-7)**: 핵심 기능 - 100개 파일
- **Phase 3 (Week 8-10)**: 완성 및 테스트 - 60개 파일

예상 개발 기간: 10주 (400시간)

## 📄 라이선스

Private - 연세바로치과 전용

## 👥 팀

개발자: Claude + 개발팀

---

**상세 문서**: `.claude/README.md` 참조
