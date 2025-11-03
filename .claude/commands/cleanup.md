---
description: 포트 3000을 사용하는 개발 서버만 안전하게 종료
---

# 안전한 서버 정리

**중요**: 절대로 `taskkill /IM node.exe` 또는 `Stop-Process -Name node` 같은 전체 node 프로세스 종료 명령어를 사용하지 마세요!

## 실행할 명령어

```bash
npm run cleanup
```

이 명령어는:
- 포트 3000을 사용하는 프로세스만 정확히 찾아서 종료합니다
- 다른 Node.js 프로세스(Claude Code 등)는 영향받지 않습니다
- 안전하고 정확한 서버 정리를 수행합니다

## 추가 옵션

백그라운드 node 프로세스를 모두 정리하려면 (신중하게):
```bash
npm run cleanup:all
```
