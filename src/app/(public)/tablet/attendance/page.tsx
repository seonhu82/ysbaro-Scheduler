/**
 * 새로운 태블릿 출퇴근 체크 페이지
 *
 * 흐름:
 * 1. 출근/퇴근 선택
 * 2. 인증 방법 선택 (QR/지문/안면)
 * 3. 인증 수행
 * 4. 완료 메시지
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Fingerprint,
  LogIn,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  Scan,
  ArrowLeft,
  Smile,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

type CheckType = 'IN' | 'OUT' | null;
type AuthMethod = 'QR_CODE' | 'BIOMETRIC_FINGERPRINT' | 'BIOMETRIC_FACE' | null;
type Step = 'SELECT_TYPE' | 'SELECT_METHOD' | 'AUTH' | 'COMPLETE';

interface Staff {
  id: string;
  name: string;
  departmentName: string;
}

interface CompletionMessage {
  title: string;
  message: string;
  icon: React.ReactNode;
}

export default function TabletAttendancePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [step, setStep] = useState<Step>('SELECT_TYPE');
  const [checkType, setCheckType] = useState<CheckType>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // QR 인증
  const [qrToken, setQrToken] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  // 직원 선택 (QR 인증용)
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pinCode, setPinCode] = useState('');

  // 지각/조퇴 사유
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState('');

  // 완료 메시지
  const [completionMessage, setCompletionMessage] = useState<CompletionMessage | null>(null);

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 사용 가능한 인증 방법 로드
  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const response = await fetch('/api/attendance/settings');
        const result = await response.json();
        if (result.success && result.data) {
          setAvailableMethods(result.data.methods || []);
        }
      } catch (error) {
        console.error('Failed to fetch methods:', error);
      }
    };

    fetchMethods();
  }, []);

  // 직원 목록 로드
  useEffect(() => {
    const fetchStaffList = async () => {
      try {
        const response = await fetch('/api/public/staff-list');
        const result = await response.json();
        if (result.success) {
          setStaffList(result.data);
        }
      } catch (error) {
        console.error('직원 목록 로드 실패:', error);
      }
    };

    fetchStaffList();
  }, []);

  // 출근/퇴근 선택
  const selectCheckType = (type: 'IN' | 'OUT') => {
    setCheckType(type);

    // 사용 가능한 방법이 1개면 바로 선택
    if (availableMethods.length === 1) {
      setAuthMethod(availableMethods[0] as AuthMethod);
      setStep('AUTH');
      if (availableMethods[0] === 'QR_CODE') {
        generateQR();
      }
    } else {
      setStep('SELECT_METHOD');
    }
  };

  // 인증 방법 선택
  const selectAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method);
    setStep('AUTH');

    if (method === 'QR_CODE') {
      generateQR();
    }
  };

  // QR 코드 생성
  const generateQR = async () => {
    try {
      const response = await fetch('/api/attendance/qr-token');
      const result = await response.json();

      if (result.success && result.token) {
        setQrToken(result.token);
        const url = `${window.location.origin}/attendance/qr/${result.token}`;
        setQrUrl(url);
      }
    } catch (error) {
      console.error('QR 생성 실패:', error);
    }
  };

  // PIN 인증 (QR 방식)
  const handlePinAuth = async () => {
    if (!selectedStaffId || !pinCode || pinCode.length !== 6) {
      alert('직원을 선택하고 6자리 PIN을 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/attendance/check/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          pinCode,
          checkType,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'PIN 인증 실패');
      }

      // 지각/조퇴 체크
      if (data.isLate || data.isEarlyLeave) {
        setNeedsReason(true);
      } else {
        showCompletionMessage(data);
      }
    } catch (error: any) {
      alert(error.message || 'PIN 인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 생체인식 (지문/안면)
  const handleBiometricAuth = async () => {
    setLoading(true);

    try {
      // TODO: WebAuthn 구현 (기존 코드 참고)
      alert('생체인식 기능은 준비 중입니다.');
    } catch (error: any) {
      alert(error.message || '생체인식에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 사유 제출
  const submitReason = async () => {
    if (!reason.trim()) {
      alert('사유를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      // TODO: 사유 제출 API 구현
      showCompletionMessage({});
    } catch (error) {
      alert('사유 제출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 완료 메시지 표시
  const showCompletionMessage = (data: any) => {
    const isCheckIn = checkType === 'IN';

    let message = isCheckIn
      ? '출근 기록이 정상적으로 되었습니다. 오늘도 화이팅하세요!'
      : '퇴근 기록이 정상적으로 되었습니다. 오늘도 수고하셨습니다.';

    // TODO: 스케줄 기반 메시지 (다음날 휴무 등)
    if (data.nextDayOff) {
      message += '\n내일은 휴무입니다. 좋은 휴무 보내세요!';
    }

    setCompletionMessage({
      title: isCheckIn ? '출근 완료' : '퇴근 완료',
      message,
      icon: <CheckCircle className="w-24 h-24 text-green-500" />,
    });

    setStep('COMPLETE');

    // 5초 후 초기화
    setTimeout(() => {
      reset();
    }, 5000);
  };

  // 초기화
  const reset = () => {
    setStep('SELECT_TYPE');
    setCheckType(null);
    setAuthMethod(null);
    setSelectedStaffId('');
    setPinCode('');
    setNeedsReason(false);
    setReason('');
    setCompletionMessage(null);
    setQrToken('');
    setQrUrl('');
  };

  // 뒤로 가기
  const goBack = () => {
    if (step === 'SELECT_METHOD') {
      setStep('SELECT_TYPE');
      setCheckType(null);
    } else if (step === 'AUTH') {
      if (availableMethods.length > 1) {
        setStep('SELECT_METHOD');
        setAuthMethod(null);
      } else {
        setStep('SELECT_TYPE');
        setCheckType(null);
        setAuthMethod(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            연세바로치과
          </h1>
          <div className="flex items-center justify-center gap-2 text-2xl text-gray-600">
            <Clock className="w-6 h-6" />
            <span>{currentTime.toLocaleTimeString('ko-KR')}</span>
          </div>
          <p className="text-gray-500 mt-1">
            {currentTime.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {/* 메인 카드 */}
        <Card className="shadow-2xl">
          <CardContent className="p-8">
            {/* 1단계: 출근/퇴근 선택 */}
            {step === 'SELECT_TYPE' && (
              <div>
                <h2 className="text-2xl font-bold text-center mb-6">
                  출퇴근 체크
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    onClick={() => selectCheckType('IN')}
                    className="h-32 text-2xl bg-blue-600 hover:bg-blue-700"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <LogIn className="w-12 h-12" />
                      <span>출근 기록</span>
                    </div>
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => selectCheckType('OUT')}
                    className="h-32 text-2xl bg-green-600 hover:bg-green-700"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <LogOut className="w-12 h-12" />
                      <span>퇴근 기록</span>
                    </div>
                  </Button>
                </div>
              </div>
            )}

            {/* 2단계: 인증 방법 선택 */}
            {step === 'SELECT_METHOD' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    뒤로
                  </Button>
                  <h2 className="text-2xl font-bold">
                    {checkType === 'IN' ? '출근' : '퇴근'} 인증 방법 선택
                  </h2>
                  <div className="w-20"></div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {availableMethods.includes('QR_CODE') && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => selectAuthMethod('QR_CODE')}
                      className="h-24 text-xl"
                    >
                      <QrCode className="w-8 h-8 mr-3" />
                      QR 코드
                    </Button>
                  )}

                  {availableMethods.includes('BIOMETRIC_FINGERPRINT') && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => selectAuthMethod('BIOMETRIC_FINGERPRINT')}
                      className="h-24 text-xl"
                    >
                      <Fingerprint className="w-8 h-8 mr-3" />
                      지문 인식
                    </Button>
                  )}

                  {availableMethods.includes('BIOMETRIC_FACE') && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => selectAuthMethod('BIOMETRIC_FACE')}
                      className="h-24 text-xl"
                    >
                      <Scan className="w-8 h-8 mr-3" />
                      안면 인식
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 3단계: 인증 */}
            {step === 'AUTH' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <Button variant="ghost" onClick={goBack}>
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    뒤로
                  </Button>
                  <h2 className="text-2xl font-bold">
                    {checkType === 'IN' ? '출근' : '퇴근'} 인증
                  </h2>
                  <div className="w-20"></div>
                </div>

                {/* QR 코드 인증 */}
                {authMethod === 'QR_CODE' && (
                  <div className="space-y-6">
                    {!selectedStaffId ? (
                      <div>
                        <div className="mb-6 text-center">
                          <p className="text-lg mb-4">
                            QR 코드를 스캔하거나 직원을 선택하세요
                          </p>
                          {qrUrl && (
                            <div className="flex justify-center mb-4">
                              <QRCodeCanvas value={qrUrl} size={200} />
                            </div>
                          )}
                        </div>

                        <div className="border-t pt-6">
                          <label className="block text-sm font-medium mb-2">
                            또는 직원 선택
                          </label>
                          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
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
                    ) : needsReason ? (
                      <div>
                        <p className="text-lg text-amber-600 mb-4">
                          {checkType === 'IN' ? '지각' : '조퇴'} 사유를 입력해주세요
                        </p>
                        <Textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="사유를 입력하세요"
                          className="h-32 text-lg"
                        />
                        <Button
                          onClick={submitReason}
                          disabled={loading}
                          className="w-full mt-4 h-14 text-lg"
                        >
                          {loading ? '처리 중...' : '제출'}
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          PIN 번호
                        </label>
                        <Input
                          type="password"
                          maxLength={6}
                          value={pinCode}
                          onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="6자리 PIN"
                          className="h-14 text-2xl text-center tracking-widest mb-4"
                        />
                        <Button
                          onClick={handlePinAuth}
                          disabled={loading || pinCode.length !== 6}
                          className="w-full h-14 text-lg"
                        >
                          {loading ? '처리 중...' : `${checkType === 'IN' ? '출근' : '퇴근'} 처리`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* 생체인식 인증 */}
                {(authMethod === 'BIOMETRIC_FINGERPRINT' || authMethod === 'BIOMETRIC_FACE') && (
                  <div className="text-center">
                    <div className="mb-6">
                      {authMethod === 'BIOMETRIC_FINGERPRINT' ? (
                        <Fingerprint className="w-24 h-24 mx-auto text-blue-600 mb-4" />
                      ) : (
                        <Scan className="w-24 h-24 mx-auto text-blue-600 mb-4" />
                      )}
                      <p className="text-xl">
                        {authMethod === 'BIOMETRIC_FINGERPRINT' ? '지문을 인식해주세요' : '얼굴을 인식해주세요'}
                      </p>
                    </div>

                    <Button
                      onClick={handleBiometricAuth}
                      disabled={loading}
                      className="w-full h-14 text-lg"
                    >
                      {loading ? '인식 중...' : '시작'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* 4단계: 완료 */}
            {step === 'COMPLETE' && completionMessage && (
              <div className="text-center py-8">
                <div className="mb-6">{completionMessage.icon}</div>
                <h2 className="text-3xl font-bold mb-4">{completionMessage.title}</h2>
                <p className="text-xl text-gray-700 whitespace-pre-line">
                  {completionMessage.message}
                </p>
                <div className="mt-8">
                  <Smile className="w-16 h-16 mx-auto text-yellow-500" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
