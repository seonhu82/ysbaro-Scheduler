/**
 * QR 코드 표시 컴포넌트
 *
 * 기능:
 * - QR 코드 생성 및 표시
 * - 5분 주기 자동 갱신
 * - 만료 시간 카운트다운
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function QRCodeDisplay() {
  const [token, setToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5분 = 300초
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // QR 토큰 가져오기
  const fetchToken = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/attendance/qr-token');
      const data = await response.json();

      if (data.success && data.data) {
        setToken(data.data.token);
        setExpiresAt(new Date(data.data.expiresAt));
      }
    } catch (error) {
      console.error('Failed to fetch QR token:', error);
    } finally {
      setLoading(false);
    }
  };

  // QR 코드 생성 (전체 URL 포함)
  useEffect(() => {
    if (token && canvasRef.current) {
      // 전체 URL 생성 (프로토콜 + 호스트 + 경로)
      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : '';
      const fullUrl = `${baseUrl}/attendance/check/${token}`;

      QRCode.toCanvas(
        canvasRef.current,
        fullUrl,
        {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        },
        (error) => {
          if (error) console.error('QR generation error:', error);
        }
      );
    }
  }, [token]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);

      if (diff <= 0) {
        // 만료되면 새 토큰 가져오기
        fetchToken();
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  // 초기 토큰 가져오기
  useEffect(() => {
    fetchToken();
  }, []);

  const handleRefresh = () => {
    fetchToken();
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold mb-4">QR 출퇴근 체크</h2>
      <div className="bg-white p-8 rounded-lg shadow-lg">
        {loading ? (
          <div className="w-64 h-64 bg-gray-100 flex items-center justify-center">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : (
          <canvas ref={canvasRef} className="w-64 h-64" />
        )}
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          남은 시간: {Math.floor(timeLeft / 60)}분 {timeLeft % 60}초
        </p>
        <p className="text-xs text-gray-500 mt-2">
          QR 코드를 스캔하여 출퇴근 체크
        </p>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>
    </div>
  );
}
