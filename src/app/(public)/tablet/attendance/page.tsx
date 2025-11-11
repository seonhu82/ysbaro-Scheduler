'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  User,
} from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  departmentName: string;
  biometricEnabled: boolean;
}

type CheckType = 'IN' | 'OUT';
type AuthMethod = 'BIOMETRIC' | 'PIN';

export default function TabletAttendancePage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [checkType, setCheckType] = useState<CheckType>('IN');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('BIOMETRIC');
  const [pinCode, setPinCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 직원 목록 로드
  useEffect(() => {
    fetchStaffList();
  }, []);

  const fetchStaffList = async () => {
    try {
      const response = await fetch('/api/staff?isActive=true');
      const data = await response.json();
      if (data.success) {
        setStaffList(data.staff);
      }
    } catch (error) {
      console.error('직원 목록 로드 실패:', error);
    }
  };

  const handleBiometricAuth = async () => {
    if (!selectedStaffId) {
      showMessage('error', '직원을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // 1. Challenge 요청
      const challengeResponse = await fetch('/api/attendance/check/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaffId }),
      });

      const challengeData = await challengeResponse.json();
      if (!challengeData.success) {
        throw new Error(challengeData.error || 'Challenge 생성 실패');
      }

      const { options } = challengeData;

      // 2. WebAuthn 인증
      const credential = await navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c) => c.charCodeAt(0)),
          allowCredentials: options.allowCredentials.map((cred: any) => ({
            ...cred,
            id: Uint8Array.from(atob(cred.id), (c) => c.charCodeAt(0)),
          })),
        },
      });

      if (!credential) {
        throw new Error('생체인증이 취소되었습니다.');
      }

      // 3. 인증 검증 및 출퇴근 기록
      const publicKeyCredential = credential as PublicKeyCredential;
      const response = publicKeyCredential.response as AuthenticatorAssertionResponse;

      const credentialData = {
        id: publicKeyCredential.id,
        rawId: arrayBufferToBase64(publicKeyCredential.rawId),
        response: {
          authenticatorData: arrayBufferToBase64(response.authenticatorData),
          clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
          signature: arrayBufferToBase64(response.signature),
          userHandle: response.userHandle
            ? arrayBufferToBase64(response.userHandle)
            : null,
        },
        type: publicKeyCredential.type,
      };

      const verifyResponse = await fetch('/api/attendance/check/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: selectedStaffId,
          credential: credentialData,
          challenge: options.challenge,
          checkType,
        }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        throw new Error(verifyData.error || '인증 실패');
      }

      showMessage('success', verifyData.message);
      resetForm();
    } catch (error: any) {
      console.error('생체인증 실패:', error);
      showMessage('error', error.message || '생체인증에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePinAuth = async () => {
    if (!selectedStaffId) {
      showMessage('error', '직원을 선택해주세요.');
      return;
    }

    if (!pinCode || pinCode.length !== 6) {
      showMessage('error', '6자리 PIN을 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    setMessage(null);

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

      showMessage('success', data.message);
      resetForm();
    } catch (error: any) {
      console.error('PIN 인증 실패:', error);
      showMessage('error', error.message || 'PIN 인증에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedStaffId('');
    setPinCode('');
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            윤성바로치과
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

        {/* 메시지 */}
        {message && (
          <Card
            className={`mb-6 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}
          >
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-3">
                {message.type === 'success' ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <span
                  className={`text-xl font-medium ${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                >
                  {message.text}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 메인 카드 */}
        <Card className="shadow-2xl">
          <CardContent className="p-8">
            {/* 출근/퇴근 선택 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Button
                size="lg"
                variant={checkType === 'IN' ? 'default' : 'outline'}
                onClick={() => setCheckType('IN')}
                className="h-20 text-xl"
              >
                <LogIn className="w-6 h-6 mr-2" />
                출근
              </Button>
              <Button
                size="lg"
                variant={checkType === 'OUT' ? 'default' : 'outline'}
                onClick={() => setCheckType('OUT')}
                className="h-20 text-xl"
              >
                <LogOut className="w-6 h-6 mr-2" />
                퇴근
              </Button>
            </div>

            {/* 직원 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">직원 선택</label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="h-14 text-lg">
                  <SelectValue placeholder="직원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id} className="text-lg py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{staff.name}</span>
                        <span className="text-gray-500">({staff.departmentName})</span>
                        {staff.biometricEnabled && (
                          <Fingerprint className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 인증 방법 선택 */}
            {selectedStaff && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">인증 방법</label>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={authMethod === 'BIOMETRIC' ? 'default' : 'outline'}
                      onClick={() => setAuthMethod('BIOMETRIC')}
                      disabled={!selectedStaff.biometricEnabled}
                      className="h-14"
                    >
                      <Fingerprint className="w-5 h-5 mr-2" />
                      생체인증
                    </Button>
                    <Button
                      variant={authMethod === 'PIN' ? 'default' : 'outline'}
                      onClick={() => setAuthMethod('PIN')}
                      className="h-14"
                    >
                      PIN 입력
                    </Button>
                  </div>
                </div>

                {/* PIN 입력 */}
                {authMethod === 'PIN' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">PIN 번호</label>
                    <Input
                      type="password"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6자리 PIN"
                      className="h-14 text-2xl text-center tracking-widest"
                    />
                  </div>
                )}

                {/* 제출 버튼 */}
                <Button
                  size="lg"
                  className="w-full h-16 text-xl"
                  onClick={authMethod === 'BIOMETRIC' ? handleBiometricAuth : handlePinAuth}
                  disabled={isProcessing || (authMethod === 'PIN' && pinCode.length !== 6)}
                >
                  {isProcessing ? (
                    '처리 중...'
                  ) : (
                    <>
                      {authMethod === 'BIOMETRIC' ? (
                        <Fingerprint className="w-6 h-6 mr-2" />
                      ) : (
                        <CheckCircle className="w-6 h-6 mr-2" />
                      )}
                      {checkType === 'IN' ? '출근' : '퇴근'} 처리
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
