/**
 * QR 코드 출퇴근 체크 페이지 (모바일)
 *
 * 흐름:
 * 1. QR 토큰 검증
 * 2. 직원 선택
 * 3. PIN 입력
 * 4. 출근/퇴근 처리
 * 5. 완료 메시지
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Clock, LogIn, LogOut, Smile } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  departmentName: string;
}

interface TokenInfo {
  checkType: 'IN' | 'OUT';
  expiresAt: string;
}

type Step = 'LOADING' | 'SELECT_STAFF' | 'ENTER_PIN' | 'ENTER_REASON' | 'COMPLETE';

export default function QRAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [step, setStep] = useState<Step>('LOADING');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordId, setRecordId] = useState<string | null>(null);

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 토큰 검증 및 초기화
  useEffect(() => {
    const initPage = async () => {
      try {
        // 토큰 검증 (공개 API 사용)
        const tokenResponse = await fetch(`/api/attendance/qr-token?token=${token}`);
        const tokenResult = await tokenResponse.json();

        if (!tokenResult.success) {
          setError('유효하지 않거나 만료된 QR 코드입니다.');
          return;
        }

        setTokenInfo({
          checkType: tokenResult.data.checkType as 'IN' | 'OUT',
          expiresAt: tokenResult.data.expiresAt,
        });

        // 직원 목록 로드
        const staffResponse = await fetch('/api/public/staff-list');
        const staffResult = await staffResponse.json();

        if (staffResult.success) {
          setStaffList(staffResult.data);
          setStep('SELECT_STAFF');
        } else {
          setError('직원 목록을 불러올 수 없습니다.');
        }
      } catch (error) {
        console.error('초기화 실패:', error);
        setError('페이지를 불러오는 중 오류가 발생했습니다.');
      }
    };

    if (token) {
      initPage();
    }
  }, [token]);

  // 직원 선택
  const handleStaffSelect = (staffId: string) => {
    setSelectedStaffId(staffId);
    setStep('ENTER_PIN');
  };

  // PIN 인증
  const handlePinSubmit = async () => {
    if (pinCode.length !== 6) {
      setError('6자리 PIN을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/attendance/check/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          pinCode,
          checkType: tokenInfo?.checkType,
          qrToken: token, // QR 토큰 전달
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'PIN 인증 실패');
      }

      // 기록 ID 저장
      setRecordId(data.record?.id || null);

      // 지각/조퇴 확인
      if (data.isLate || data.isEarlyLeave) {
        setNeedsReason(true);
        setStep('ENTER_REASON');
      } else {
        setStep('COMPLETE');
        // 3초 후 초기화
        setTimeout(() => {
          resetForm();
        }, 3000);
      }
    } catch (error: any) {
      setError(error.message || 'PIN 인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사유 제출
  const handleReasonSubmit = async () => {
    if (!reason.trim()) {
      setError('사유를 입력해주세요.');
      return;
    }

    if (!recordId) {
      setError('출퇴근 기록을 찾을 수 없습니다.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/attendance/submit-reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          reason,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '사유 제출 실패');
      }

      setStep('COMPLETE');

      // 3초 후 초기화
      setTimeout(() => {
        resetForm();
      }, 3000);
    } catch (error: any) {
      setError(error.message || '사유 제출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setStep('SELECT_STAFF');
    setSelectedStaffId('');
    setPinCode('');
    setNeedsReason(false);
    setReason('');
    setError('');
  };

  // 에러 화면
  if (error && step === 'LOADING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-xl text-red-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="mt-4">
              메인으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 로딩 화면
  if (step === 'LOADING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-xl text-gray-600">로딩 중...</p>
      </div>
    );
  }

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);
  const checkTypeLabel = tokenInfo?.checkType === 'IN' ? '출근' : '퇴근';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto mt-8">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            연세바로치과
          </h1>
          <div className="flex items-center justify-center gap-2 text-xl text-gray-600">
            <Clock className="w-5 h-5" />
            <span>{currentTime.toLocaleTimeString('ko-KR')}</span>
          </div>
          <p className="text-gray-500 mt-1">
            {currentTime.toLocaleDateString('ko-KR', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {/* 메인 카드 */}
        <Card className="shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              {tokenInfo?.checkType === 'IN' ? (
                <LogIn className="w-6 h-6 text-blue-600" />
              ) : (
                <LogOut className="w-6 h-6 text-green-600" />
              )}
              <span>{checkTypeLabel} 체크</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-6">
            {/* 직원 선택 */}
            {step === 'SELECT_STAFF' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-base font-medium mb-3">
                    직원을 선택하세요
                  </label>
                  <Select value={selectedStaffId} onValueChange={handleStaffSelect}>
                    <SelectTrigger className="h-14 text-lg">
                      <SelectValue placeholder="직원을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id} className="text-lg py-3">
                          {staff.name} ({staff.departmentName})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* PIN 입력 */}
            {step === 'ENTER_PIN' && (
              <div className="space-y-4">
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-center text-lg font-medium">
                    {selectedStaff?.name} ({selectedStaff?.departmentName})
                  </p>
                </div>

                <div>
                  <label className="block text-base font-medium mb-3">
                    PIN 번호를 입력하세요
                  </label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => {
                      setPinCode(e.target.value.replace(/\D/g, ''));
                      setError('');
                    }}
                    placeholder="6자리 PIN"
                    className="h-16 text-3xl text-center tracking-widest"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-center">{error}</p>
                )}

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="h-12 text-base"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handlePinSubmit}
                    disabled={loading || pinCode.length !== 6}
                    className="h-12 text-base"
                  >
                    {loading ? '처리 중...' : `${checkTypeLabel} 처리`}
                  </Button>
                </div>
              </div>
            )}

            {/* 사유 입력 */}
            {step === 'ENTER_REASON' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-center text-lg font-medium text-amber-800">
                    {tokenInfo?.checkType === 'IN' ? '지각' : '조퇴'} 사유를 입력해주세요
                  </p>
                </div>

                <Textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setError('');
                  }}
                  placeholder="사유를 입력하세요"
                  className="h-32 text-base"
                  autoFocus
                />

                {error && (
                  <p className="text-red-600 text-center">{error}</p>
                )}

                <Button
                  onClick={handleReasonSubmit}
                  disabled={loading}
                  className="w-full h-12 text-base"
                >
                  {loading ? '처리 중...' : '제출'}
                </Button>
              </div>
            )}

            {/* 완료 */}
            {step === 'COMPLETE' && (
              <div className="text-center py-8">
                <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-4" />
                <h2 className="text-2xl font-bold mb-3">
                  {checkTypeLabel} 완료
                </h2>
                <p className="text-lg text-gray-700 mb-2">
                  {selectedStaff?.name}님
                </p>
                <p className="text-base text-gray-600">
                  {tokenInfo?.checkType === 'IN'
                    ? '출근 기록이 정상적으로 되었습니다.'
                    : '퇴근 기록이 정상적으로 되었습니다.'}
                </p>
                <div className="mt-6">
                  <Smile className="w-12 h-12 mx-auto text-yellow-500" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
