# Claude Code 세션 시작 시 필독 사항

> 🚨 **새로운 Claude 세션을 시작할 때 반드시 이 파일을 먼저 읽어주세요!**

## ⚠️ 서버 정리 필수 지침

코드 수정 후 개발 서버를 재시작할 때 **반드시** 다음 절차를 따라야 합니다:

### 1. 실행 중인 프로세스 확인
```bash
netstat -ano | findstr :3000
```

### 2. 안전한 프로세스 종료
```bash
# ✅ 올바른 방법: 특정 PID만 종료
taskkill /PID <위에서_확인한_PID> /F

# ⛔ 절대 사용 금지!
# taskkill /IM node.exe /F  <- 이 명령은 Claude Code도 함께 종료시킵니다!
```

### 3. 개발 서버 재시작
```bash
npm run dev
```

## 왜 중요한가?

- `taskkill /IM node.exe /F`를 사용하면 **Claude Code 프로세스도 함께 종료**됩니다
- 이로 인해 작업 중인 세션이 끊기고 사용자가 다시 시작해야 합니다
- **반드시 특정 PID만 종료**하여 Claude Code는 유지해야 합니다

## 상세 가이드

더 자세한 내용은 [`docs/SERVER_CLEANUP_GUIDE.md`](./docs/SERVER_CLEANUP_GUIDE.md)를 참조하세요.

## 프로젝트 개요

이 프로젝트는 치과 직원 스케줄 관리 시스템입니다.

- **기술 스택**: Next.js 14, TypeScript, Prisma, PostgreSQL
- **데이터베이스**: PostgreSQL 18 (로컬 설치)
- **개발 서버 포트**: 3000
- **데이터베이스 포트**: 5432

## 자주 사용하는 명령어

```bash
# 개발 서버 실행
npm run dev

# 데이터베이스 마이그레이션
npx prisma migrate dev

# 타입 체크
npx tsc --noEmit

# 프로덕션 빌드
npm run build

# PostgreSQL 연결 테스트
PGPASSWORD=postgres "/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "SELECT 1;"
```

## 트러블슈팅

### 포트 충돌
- **증상**: "Port 3000 is already in use"
- **해결**: 위의 안전한 프로세스 종료 절차 수행

### 데이터베이스 연결 오류
- **증상**: "Can't reach database server"
- **해결**: PostgreSQL 서비스 확인 및 재시작

### Prisma 스키마 동기화 오류
- **증상**: "Schema is out of sync with database"
- **해결**: `npx prisma migrate dev` 또는 `npx prisma db push`

---

**📌 이 지침을 지키지 않으면 사용자가 매번 같은 작업을 반복 요청해야 합니다!**
