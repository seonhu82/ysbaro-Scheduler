'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Fingerprint, UserCheck, UserX, Search, AlertCircle } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  departmentName: string;
  biometricEnabled: boolean;
  biometricDeviceType?: string;
  biometricRegisteredAt?: string;
}

export default function BiometricRegistrationPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 직원 목록 로드
  useEffect(() => {
    fetchStaffList();
  }, []);

  // 필터링
  useEffect(() => {
    let filtered = staffList;

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(
        (staff) =>
          staff.name.includes(searchTerm) ||
          staff.departmentName.includes(searchTerm)
      );
    }

    // 타입 필터
    if (filterType === 'registered') {
      filtered = filtered.filter((staff) => staff.biometricEnabled);
    } else if (filterType === 'not-registered') {
      filtered = filtered.filter((staff) => !staff.biometricEnabled);
    }

    setFilteredStaff(filtered);
  }, [staffList, searchTerm, filterType]);

  const fetchStaffList = async () => {
    try {
      const response = await fetch('/api/staff');
      const data = await response.json();
      if (data.success) {
        setStaffList(data.staff);
        setFilteredStaff(data.staff);
      }
    } catch (error) {
      console.error('직원 목록 로드 실패:', error);
      showMessage('error', '직원 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleRegisterBiometric = async (staff: Staff) => {
    setSelectedStaff(staff);
    setIsRegistering(true);
    setMessage(null);

    try {
      // 1. Challenge 요청
      const challengeResponse = await fetch('/api/biometric/register/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id }),
      });

      const challengeData = await challengeResponse.json();
      if (!challengeData.success) {
        throw new Error(challengeData.error || 'Challenge 생성 실패');
      }

      const { options } = challengeData;

      // 2. WebAuthn 등록 (브라우저 API)
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), (c: string) => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(options.user.id, (c: string) => c.charCodeAt(0)),
          },
        },
      });

      if (!credential) {
        throw new Error('생체인증 등록이 취소되었습니다.');
      }

      // 3. Credential 검증 및 저장
      const publicKeyCredential = credential as PublicKeyCredential;
      const response = publicKeyCredential.response as AuthenticatorAttestationResponse;

      const credentialData = {
        id: publicKeyCredential.id,
        rawId: arrayBufferToBase64(publicKeyCredential.rawId),
        response: {
          attestationObject: arrayBufferToBase64(response.attestationObject),
          clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
        },
        type: publicKeyCredential.type,
        authenticatorAttachment: publicKeyCredential.authenticatorAttachment,
      };

      const verifyResponse = await fetch('/api/biometric/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: staff.id,
          credential: credentialData,
          challenge: options.challenge,
        }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        throw new Error(verifyData.error || '등록 검증 실패');
      }

      showMessage('success', `${staff.name}님의 생체인증이 등록되었습니다.`);
      fetchStaffList(); // 목록 새로고침
    } catch (error: any) {
      console.error('생체인증 등록 실패:', error);
      showMessage('error', error.message || '생체인증 등록에 실패했습니다.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemoveBiometric = async (staff: Staff) => {
    if (!confirm(`${staff.name}님의 생체인증 등록을 해제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/biometric/register/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: staff.id }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '등록 해제 실패');
      }

      showMessage('success', `${staff.name}님의 생체인증이 해제되었습니다.`);
      fetchStaffList();
    } catch (error: any) {
      console.error('생체인증 해제 실패:', error);
      showMessage('error', error.message || '생체인증 해제에 실패했습니다.');
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">생체인증 등록 관리</h1>
        <p className="text-gray-600">
          직원들의 지문/안면 인식을 등록하여 빠른 출퇴근 체크를 가능하게 합니다.
        </p>
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <AlertCircle className="w-5 h-5" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 필터 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder="이름, 사번, 부서 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 직원</SelectItem>
                <SelectItem value="registered">등록 완료</SelectItem>
                <SelectItem value="not-registered">미등록</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 직원 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((staff) => (
          <Card key={staff.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{staff.name}</span>
                {staff.biometricEnabled ? (
                  <UserCheck className="w-5 h-5 text-green-600" />
                ) : (
                  <UserX className="w-5 h-5 text-gray-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">부서: {staff.departmentName}</p>
                {staff.biometricEnabled && (
                  <>
                    <p className="text-sm text-green-600 font-medium">
                      생체인증 등록됨
                    </p>
                    {staff.biometricDeviceType && (
                      <p className="text-sm text-gray-500">
                        타입: {staff.biometricDeviceType === 'fingerprint' ? '지문' : '안면'}
                      </p>
                    )}
                    {staff.biometricRegisteredAt && (
                      <p className="text-sm text-gray-500">
                        등록일: {new Date(staff.biometricRegisteredAt).toLocaleDateString()}
                      </p>
                    )}
                  </>
                )}
              </div>
              {staff.biometricEnabled ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleRemoveBiometric(staff)}
                >
                  등록 해제
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleRegisterBiometric(staff)}
                  disabled={isRegistering && selectedStaff?.id === staff.id}
                >
                  <Fingerprint className="w-4 h-4 mr-2" />
                  {isRegistering && selectedStaff?.id === staff.id
                    ? '등록 중...'
                    : '생체인증 등록'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">조건에 맞는 직원이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
