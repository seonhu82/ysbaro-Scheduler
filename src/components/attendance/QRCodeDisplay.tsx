/**
 * QR 코드 표시 컴포넌트
 *
 * 기능:
 * - QR 코드 생성 및 표시
 * - 5분 주기 자동 갱신
 * - 만료 시간 카운트다운
 */

'use client';

import { useEffect, useState } from 'react';

export function QRCodeDisplay() {
  const [token, setToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5분 = 300초

  // TODO: 구현 예정
  // 1. QR 코드 라이브러리 사용 (qrcode)
  // 2. 토큰 자동 갱신
  // 3. 카운트다운 타이머

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-4">QR 출퇴근 체크</h2>
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <div className="w-64 h-64 bg-gray-200 flex items-center justify-center">
          <p className="text-gray-500">QR 코드 영역</p>
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          남은 시간: {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
        </p>
        <p className="text-xs text-gray-500 mt-2">
          QR 코드를 스캔하여 출퇴근 체크
        </p>
      </div>
    </div>
  );
}
