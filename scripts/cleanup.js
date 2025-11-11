#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

const PORT = 3000;

function cleanupPort() {
  try {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: netstat을 사용하여 포트 3000을 사용하는 프로세스 찾기
      try {
        const netstatOutput = execSync(
          `netstat -ano | findstr :${PORT}`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        // PID 추출
        const lines = netstatOutput.split('\n').filter(line => line.includes('LISTENING'));
        const pids = new Set();

        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        });

        if (pids.size === 0) {
          console.log(`포트 ${PORT}를 사용하는 프로세스가 없습니다.`);
          return;
        }

        // 프로세스 종료
        pids.forEach(pid => {
          try {
            console.log(`프로세스 ${pid} 종료 중...`);
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
            console.log(`프로세스 ${pid} 종료 완료`);
          } catch (error) {
            console.error(`프로세스 ${pid} 종료 실패:`, error.message);
          }
        });

      } catch (error) {
        // netstat에서 결과가 없으면 에러가 발생하는데, 이는 정상
        if (error.status === 1) {
          console.log(`포트 ${PORT}를 사용하는 프로세스가 없습니다.`);
        } else {
          throw error;
        }
      }

    } else {
      // macOS/Linux: lsof 사용
      try {
        const lsofOutput = execSync(
          `lsof -ti:${PORT}`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        const pids = lsofOutput.trim().split('\n').filter(Boolean);

        if (pids.length === 0) {
          console.log(`포트 ${PORT}를 사용하는 프로세스가 없습니다.`);
          return;
        }

        pids.forEach(pid => {
          try {
            console.log(`프로세스 ${pid} 종료 중...`);
            execSync(`kill -9 ${pid}`, { stdio: 'inherit' });
            console.log(`프로세스 ${pid} 종료 완료`);
          } catch (error) {
            console.error(`프로세스 ${pid} 종료 실패:`, error.message);
          }
        });

      } catch (error) {
        if (error.status === 1) {
          console.log(`포트 ${PORT}를 사용하는 프로세스가 없습니다.`);
        } else {
          throw error;
        }
      }
    }

  } catch (error) {
    console.error('Cleanup 중 오류 발생:', error.message);
    process.exit(0); // cleanup 실패해도 dev 서버는 시작하도록 성공으로 처리
  }
}

cleanupPort();
