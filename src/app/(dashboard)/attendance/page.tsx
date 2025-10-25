/**
 * 출퇴근 현황 대시보드
 * 경로: /attendance
 *
 * 기능:
 * - 실시간 출근 현황
 * - 오늘의 출퇴근 통계
 * - 의심 패턴 알림
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, AlertTriangle, CheckCircle, XCircle, QrCode } from 'lucide-react';
import Link from 'next/link';
import { QRCodeDisplay } from '@/components/attendance/QRCodeDisplay';

interface TodayStats {
  totalStaff: number;
  checkedIn: number;
  checkedOut: number;
  notCheckedIn: number;
  suspiciousCount: number;
}

export default function AttendanceDashboardPage() {
  const [stats, setStats] = useState<TodayStats>({
    totalStaff: 0,
    checkedIn: 0,
    checkedOut: 0,
    notCheckedIn: 0,
    suspiciousCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/attendance/today-stats')
        const result = await response.json()

        if (result.success && result.data) {
          setStats(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch today stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTodayStats()

    // 30초마다 자동 새로고침
    const interval = setInterval(fetchTodayStats, 30000)
    return () => clearInterval(interval)
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">출퇴근 현황</h1>
        <p className="text-gray-600">
          직원들의 실시간 출퇴근 현황을 확인합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 왼쪽: QR 코드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              출퇴근 QR 코드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QRCodeDisplay />
          </CardContent>
        </Card>

        {/* 오른쪽: 오늘의 통계 */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                오늘의 출퇴근 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-700 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">출근</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.checkedIn}명</div>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">퇴근</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.checkedOut}명</div>
                </div>

                <div className="bg-amber-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-700 mb-2">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">미출근</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.notCheckedIn}명</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-700 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">전체 직원</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.totalStaff}명</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.suspiciousCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="w-5 h-5" />
                  의심 패턴 감지
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-800 mb-3">
                  {stats.suspiciousCount}건의 의심스러운 출퇴근 기록이 감지되었습니다
                </p>
                <Link href="/attendance/history">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-900">
                    자세히 보기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/attendance/history">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <h3 className="font-semibold">출퇴근 기록</h3>
              <p className="text-sm text-gray-500">전체 기록 조회</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/attendance/statistics">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <h3 className="font-semibold">통계</h3>
              <p className="text-sm text-gray-500">출퇴근 통계 분석</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/attendance/qr">
          <Card className="hover:bg-gray-50 transition cursor-pointer">
            <CardContent className="p-6 text-center">
              <QrCode className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              <h3 className="font-semibold">QR 관리</h3>
              <p className="text-sm text-gray-500">QR 코드 전체화면</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
