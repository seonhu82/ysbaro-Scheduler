# CodeMaker v2 🚀

**AI 기반 완전 자동 프로젝트 생성, 분석, 수정 플랫폼**

CodeMaker v2는 기획서만으로 완전한 프로젝트를 자동 생성하고, 기존 프로젝트를 분석하며, 자연어 명령으로 코드를 수정할 수 있는 혁신적인 AI 플랫폼입니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)

## ✨ 주요 기능

### 🎯 AI 프로젝트 생성
- **완전 자동화**: 기획서 입력만으로 실행 가능한 프로젝트 완성
- **실시간 진행률**: WebSocket 기반 실시간 생성 과정 모니터링
- **다양한 스택**: React, Vue, Node.js, Python, Java 등 50+ 기술 스택 지원

### 📊 프로젝트 분석
- **구조 분석**: 기존 프로젝트의 아키텍처 및 기술 스택 자동 분석
- **품질 평가**: 코드 품질, 보안, 성능 등 종합적 평가
- **개선 제안**: AI 기반 최적화 및 리팩토링 제안

### ✏️ 자연어 수정
- **자연어 명령**: "로그인 기능 추가해줘", "버그 수정해줘" 등 자연어 입력
- **영향도 분석**: 수정 사항이 다른 부분에 미치는 영향 사전 분석
- **최소 침습**: 기존 코드 보존하며 필요 부분만 정밀 수정

### 💳 크레딧 시스템
- **투명한 비용**: 토큰 사용량 기반 명확한 비용 계산
- **유연한 플랜**: Free, Pro, Team, Enterprise 다양한 구독 옵션
- **실시간 모니터링**: 크레딧 사용량 실시간 추적

## 🏗️ 시스템 아키텍처

```
사용자 → Frontend (React) → Backend (Node.js) → AI Engine (Python) → AI APIs
                ↓                    ↓                   ↓
             WebSocket         PostgreSQL           Vector DB
                ↓                    ↓                   ↓
             실시간 UI            사용자 데이터          AI 학습 데이터
```

## 📁 프로젝트 구조

```
codemaker-v2/
├── frontend/              # React + TypeScript 웹사이트
├── backend/               # Node.js + Express API 서버
├── ai-engine/             # Python + FastAPI AI 서비스
├── docker-compose.yml     # 전체 시스템 오케스트레이션
├── .env.example          # 환경 변수 템플릿
└── README.md             # 이 파일
```

## 🚀 빠른 시작

### 1️⃣ 사전 요구사항

- **Docker** & **Docker Compose** 설치
- **Node.js 18+** (로컬 개발용)
- **Python 3.11+** (로컬 개발용)
- **Git** 설치

### 2️⃣ 저장소 클론

```bash
git clone https://github.com/seonhu82/codemaker-v2.git
cd codemaker-v2
```

### 3️⃣ 환경 변수 설정

```bash
# 환경 변수 파일 생성
cp .env.example .env

# .env 파일을 열어서 다음 항목들을 설정:
# - ANTHROPIC_API_KEY: Claude API 키
# - OPENAI_API_KEY: OpenAI API 키  
# - STRIPE_SECRET_KEY: Stripe 결제 키 (선택사항)
# - 기타 필요한 설정들
```

### 4️⃣ Docker로 전체 시스템 실행

```bash
# 전체 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 상태 확인
docker-compose ps
```

### 5️⃣ 웹사이트 접속

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **AI Engine**: http://localhost:8000
- **API 문서**: http://localhost:3001/docs

## 🛠️ 로컬 개발 설정

### Frontend 개발

```bash
cd frontend
npm install
npm run dev
```

### Backend 개발

```bash
cd backend
npm install
npm run dev
```

### AI Engine 개발

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## 📊 기술 스택

### Frontend
- **React 18** + TypeScript
- **Redux Toolkit** - 상태 관리
- **Tailwind CSS** - 스타일링
- **Socket.io** - 실시간 통신
- **Monaco Editor** - 코드 편집기
- **Framer Motion** - 애니메이션

### Backend
- **Node.js 18** + TypeScript
- **Express.js** - 웹 프레임워크
- **Prisma** - 데이터베이스 ORM
- **PostgreSQL** - 메인 데이터베이스
- **Redis** - 캐시 및 세션
- **JWT** - 인증 시스템

### AI Engine
- **Python 3.11** + FastAPI
- **Anthropic Claude** - 메인 AI 모델
- **OpenAI GPT** - 보조 AI 모델
- **LangChain** - AI 애플리케이션 프레임워크
- **Vector Database** - 임베딩 저장소

## 🔧 주요 명령어

```bash
# 전체 시스템 시작
docker-compose up -d

# 특정 서비스만 시작
docker-compose up frontend backend

# 서비스 재시작
docker-compose restart ai-engine

# 로그 확인
docker-compose logs -f backend

# 데이터베이스 마이그레이션
docker-compose exec backend npm run db:migrate

# 전체 시스템 정리
docker-compose down -v
```

## 🧪 테스트 실행

```bash
# Frontend 테스트
cd frontend && npm test

# Backend 테스트
cd backend && npm test

# AI Engine 테스트
cd ai-engine && pytest
```

## 📈 모니터링 및 로그

```bash
# 실시간 로그 확인
docker-compose logs -f

# 개별 서비스 로그
docker-compose logs frontend
docker-compose logs backend
docker-compose logs ai-engine

# 시스템 리소스 모니터링
docker stats
```

## 🔐 보안 고려사항

### 필수 보안 설정
- `.env` 파일의 모든 기본 패스워드 변경
- JWT Secret 키를 강력한 랜덤 값으로 설정
- 프로덕션에서는 HTTPS 필수 사용
- 데이터베이스 접근 권한 최소화

### API 키 관리
- 모든 API 키는 환경 변수로 관리
- Git에 API 키 절대 커밋 금지
- 정기적인 API 키 로테이션

## 🚢 배포 가이드

### 프로덕션 배포

```bash
# 프로덕션 환경 설정
cp .env.example .env.production

# 프로덕션 빌드
docker-compose -f docker-compose.prod.yml up -d

# SSL 인증서 설정 (Let's Encrypt)
docker-compose exec nginx certbot --nginx
```

### AWS/GCP 배포
- ECS/EKS 또는 GKE 사용 권장
- RDS PostgreSQL + ElastiCache Redis 구성
- CloudFront/CloudCDN으로 정적 자산 배포

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🆘 지원 및 문의

- **이슈 리포트**: [GitHub Issues](https://github.com/seonhu82/codemaker-v2/issues)
- **기능 요청**: [Feature Requests](https://github.com/seonhu82/codemaker-v2/discussions)
- **이메일**: support@codemaker.dev

## 🎯 로드맵

### v2.1 (예정)
- [ ] 팀 협업 기능 강화
- [ ] 더 많은 프로그래밍 언어 지원
- [ ] 모바일 앱 출시

### v2.2 (예정)
- [ ] 플러그인 시스템
- [ ] 자체 AI 모델 학습
- [ ] 엔터프라이즈 SSO 지원

---

**CodeMaker v2** - AI가 만드는 완벽한 프로젝트 🚀

Made with ❤️ by the CodeMaker Team
