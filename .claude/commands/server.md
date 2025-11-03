---
description: 개발 서버를 안전하게 재시작 (정리 후 시작)
---

# 개발 서버 재시작

안전하게 기존 서버를 정리하고 새로 시작합니다.

## 실행할 명령어

```bash
npm run cleanup && npm run dev
```

이 명령어는:
1. 포트 3000을 사용하는 기존 서버만 정확히 종료
2. 새로운 개발 서버 시작
3. Claude Code 같은 다른 프로세스는 보호

## 주의사항

**절대 사용 금지**:
- ❌ `taskkill /IM node.exe /F`
- ❌ `Stop-Process -Name node -Force`
- ❌ `killall node`

**항상 사용**:
- ✅ `npm run cleanup`
- ✅ `/cleanup` (Claude 명령어)
- ✅ `/server` (Claude 명령어)
