# Replit 배포 가이드

## 1. Replit에서 프로젝트 생성

1. **Replit 접속** - https://replit.com 로그인
2. **Import from GitHub** 클릭
3. **Repository URL 입력**
   ```
   https://github.com/seonhu82/ysbaro-Scheduler.git
   ```
4. **Import** 클릭

## 2. PostgreSQL 데이터베이스 설정

### 2.1 Replit PostgreSQL 추가
1. 왼쪽 사이드바에서 **Tools** 클릭
2. **PostgreSQL** 선택 및 추가
3. 자동으로 DATABASE_URL 환경변수 생성됨

### 2.2 환경변수 설정
**Secrets (Environment Variables)** 탭에서 다음 환경변수 추가:

```bash
# 데이터베이스 (자동 생성된 값 사용)
DATABASE_URL=postgresql://...

# NextAuth 설정
NEXTAUTH_URL=https://your-repl-name.your-username.repl.co
NEXTAUTH_SECRET=랜덤한_긴_문자열_생성_필요

# 이메일 설정 (선택사항)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=연세바로치과

# 카카오톡 알림 (선택사항)
KAKAO_API_KEY=
KAKAO_SENDER_KEY=
```

### NEXTAUTH_SECRET 생성 방법
Shell에서 실행:
```bash
openssl rand -base64 32
```

## 3. 데이터베이스 초기화

### 3.1 Prisma 마이그레이션
Replit Shell에서 실행:
```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 데이터베이스 마이그레이션 (프로덕션용)
npx prisma migrate deploy

# 또는 개발 모드 (스키마 변경 시)
npx prisma migrate dev
```

### 3.2 초기 데이터 설정

#### 옵션 1: 빈 데이터베이스로 시작 (권장)
```bash
# 프로그램 실행 후 회원가입으로 첫 관리자 계정 생성
npm run dev
```

#### 옵션 2: 로컬 데이터 복사 (선택사항)
로컬 데이터를 옮기려면:

1. **로컬에서 데이터 덤프**
   ```bash
   PGPASSWORD=postgres pg_dump -U postgres -d dental_scheduler -f backup.sql
   ```

2. **Replit에 업로드**
   - backup.sql 파일을 Replit에 업로드

3. **Replit에서 복원**
   ```bash
   psql $DATABASE_URL -f backup.sql
   ```

## 4. 빌드 및 실행

### 4.1 .replit 파일 생성
프로젝트 루트에 `.replit` 파일 생성:
```toml
run = "npm run dev"
entrypoint = "server.js"

[nix]
channel = "stable-22_11"

[deployment]
run = ["npm", "run", "build"]
deploymentTarget = "cloudrun"
```

### 4.2 실행
```bash
npm run dev
```

## 5. 배포 후 확인사항

### 5.1 첫 관리자 계정 생성
1. 브라우저에서 Replit URL 접속
2. `/register` 페이지에서 회원가입
3. 첫 번째 사용자는 자동으로 ADMIN 권한 부여됨

### 5.2 클리닉 초기 설정
1. 관리자로 로그인
2. 설정 > 클리닉 설정에서:
   - 진료 시간 설정
   - 근무 주 설정
   - 공휴일 설정

### 5.3 직원 등록
1. 설정 > 직원 관리에서 직원 추가
2. 각 직원의:
   - 이름, 직급 입력
   - 생년월일 6자리 (PIN 코드로 사용)
   - 권한 설정

## 6. 프로덕션 체크리스트

- [ ] DATABASE_URL 확인
- [ ] NEXTAUTH_SECRET 설정 (강력한 랜덤 문자열)
- [ ] NEXTAUTH_URL을 실제 배포 URL로 설정
- [ ] 이메일 SMTP 설정 (알림용)
- [ ] 관리자 계정 생성 및 강력한 비밀번호 설정
- [ ] 클리닉 초기 설정 완료
- [ ] 직원 정보 등록
- [ ] 테스트 스케줄 생성 및 확인

## 7. 데이터베이스 관리

### Prisma Studio로 데이터 확인
```bash
npx prisma studio
```

### 백업 (정기적으로 실행)
```bash
# 데이터 백업
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## 8. 문제 해결

### 빌드 에러 발생 시
```bash
# 캐시 삭제
rm -rf .next
rm -rf node_modules
npm install
npx prisma generate
npm run build
```

### 데이터베이스 연결 오류
- DATABASE_URL 환경변수 확인
- Replit PostgreSQL이 실행 중인지 확인
- `npx prisma migrate deploy` 재실행

### 세션 오류
- NEXTAUTH_SECRET 환경변수 확인
- NEXTAUTH_URL이 실제 배포 URL과 일치하는지 확인

## 9. 유지보수

### 코드 업데이트
```bash
# GitHub에서 최신 코드 가져오기
git pull origin master

# 의존성 업데이트
npm install

# 데이터베이스 마이그레이션
npx prisma migrate deploy

# 재시작
npm run dev
```

### 모니터링
- Replit 로그 확인
- 데이터베이스 용량 모니터링
- 정기 백업 수행

## 10. 보안 권장사항

1. **강력한 비밀번호 사용**
   - 관리자 계정: 최소 12자 이상, 대소문자/숫자/특수문자 조합
   - NEXTAUTH_SECRET: 32바이트 이상 랜덤 문자열

2. **환경변수 보안**
   - 모든 중요 정보는 환경변수로 관리
   - .env 파일은 절대 GitHub에 커밋하지 않기

3. **정기 백업**
   - 주 1회 이상 데이터베이스 백업
   - 백업 파일은 안전한 곳에 보관

4. **접근 권한 관리**
   - 직원별 적절한 권한 부여
   - 퇴사자 계정은 즉시 비활성화

---

배포 중 문제가 발생하면 Replit 로그를 확인하거나 GitHub Issues에 문의하세요.
