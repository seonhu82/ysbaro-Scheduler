# 서버 정리 및 실행 가이드

## 코드 수정 시 서버 정리 절차

### 1. 실행 중인 프로세스 확인
```bash
# 포트 사용 중인 프로세스 확인 (Windows)
netstat -ano | findstr :3000
netstat -ano | findstr :5432
```

### 2. 프로세스 종료
```bash
# ⚠️ 중요: Claude Code는 종료하지 마세요!

# 방법 1: 특정 PID만 종료 (권장)
# 1단계에서 확인한 PID를 사용하여 해당 프로세스만 종료
taskkill /PID <프로세스_ID> /F

# 방법 2: 포트별로 프로세스 찾아서 종료
# 3000 포트 사용 프로세스 찾기
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3000') do @taskkill /PID %a /F

# ⛔ 절대 사용 금지: 모든 Node 프로세스를 종료하면 Claude Code도 함께 종료됩니다!
# taskkill /IM node.exe /F  <- 이 명령어는 사용하지 마세요!
```

### 3. 데이터베이스 마이그레이션 확인
```bash
# Prisma 스키마 변경 시
npx prisma migrate dev --name <변경사항_설명>

# 또는 기존 마이그레이션 적용
npx prisma migrate deploy
```

### 4. 빌드 정리 (선택사항)
```bash
# Next.js 캐시 및 빌드 폴더 정리
rm -rf .next
rm -rf node_modules/.cache
```

### 5. 개발 서버 시작
```bash
npm run dev
```

## 일반적인 서버 시작 순서

1. **PostgreSQL 확인**: 데이터베이스 서버가 실행 중인지 확인
2. **의존성 설치**: `npm install` (package.json 변경 시)
3. **환경 변수 확인**: `.env` 파일 설정 확인
4. **마이그레이션**: 스키마 변경 시 `npx prisma migrate dev`
5. **서버 실행**: `npm run dev`

## 문제 해결

### 포트 충돌
- 증상: "Port 3000 is already in use"
- 해결: 위 2번 프로세스 종료 절차 수행

### 데이터베이스 연결 오류
- 증상: "Can't reach database server"
- 해결: PostgreSQL 서비스 확인 및 재시작

### Prisma 스키마 동기화 오류
- 증상: "Schema is out of sync with database"
- 해결: `npx prisma migrate dev` 또는 `npx prisma db push`

### TypeScript 컴파일 오류
- 증상: "Type error" 메시지
- 해결:
  1. `npx tsc --noEmit`로 오류 확인
  2. 타입 오류 수정
  3. `.next` 폴더 삭제 후 재시작

## 빠른 참조 명령어

```bash
# 3000 포트 프로세스만 종료 후 재시작 (안전)
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3000') do @taskkill /PID %a /F && npm run dev

# PostgreSQL 연결 테스트
PGPASSWORD=postgres "/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -c "SELECT 1;"

# Prisma 스키마 재생성
npx prisma generate

# 프로덕션 빌드 테스트
npm run build
```

## 주의사항

- **⚠️ 절대 `taskkill /IM node.exe /F` 사용 금지**: Claude Code도 함께 종료됩니다
- **권장**: 특정 PID만 종료하거나 포트별로 프로세스를 찾아서 종료하세요
- 프로세스 강제 종료 시 저장되지 않은 데이터 손실 가능
- 마이그레이션 실행 전 데이터베이스 백업 권장
- 프로덕션 환경에서는 `migrate deploy` 사용
