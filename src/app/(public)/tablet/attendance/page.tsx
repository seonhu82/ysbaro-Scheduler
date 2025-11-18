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
import { io, Socket } from 'socket.io-client';

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
  const [clinicId, setClinicId] = useState<string | null>(null);

  // QR URL 설정
  const [useExternalUrl, setUseExternalUrl] = useState(false);

  // QR 인증
  const [qrToken, setQrToken] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [qrPollingInterval, setQrPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 직원 선택 (QR 인증용)
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [pinCode, setPinCode] = useState('');

  // 지각/조퇴/스케줄 외 출근 사유
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState('');
  const [attendanceRecordId, setAttendanceRecordId] = useState<string | null>(null);
  const [reasonInfo, setReasonInfo] = useState<{
    isLate?: boolean;
    lateMinutes?: number;
    isEarlyLeave?: boolean;
    earlyMinutes?: number;
    isUnscheduled?: boolean;
  }>({});

  // 완료 메시지
  const [completionMessage, setCompletionMessage] = useState<CompletionMessage | null>(null);

  // 기기 진단 모드
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<{
    webAuthnSupported: boolean;
    cameraAvailable: boolean;
    cameraPermission: string;
    mediaDevices: MediaDeviceInfo[];
  } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Socket.io 스트리밍
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // URL 파라미터에서 clinicId 읽기
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clinicIdParam = params.get('clinicId');
    if (clinicIdParam) {
      setClinicId(clinicIdParam);
    }
  }, []);

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 사용 가능한 인증 방법 및 QR URL 설정 로드
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/attendance/settings');
        const result = await response.json();
        if (result.success && result.data) {
          setAvailableMethods(result.data.methods || []);
          setUseExternalUrl(result.data.useExternalUrlForQR || false);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };

    fetchSettings();
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

  // Socket.io 연결
  useEffect(() => {
    const socketIo = io();
    setSocket(socketIo);

    socketIo.on('connect', () => {
      console.log('🔌 Socket connected:', socketIo.id);
      // 연결되면 clinicId 등록
      if (clinicId) {
        socketIo.emit('tablet:register', { clinicId });
      }
    });

    socketIo.on('tablet:stream-started', (data: { clinicId: string }) => {
      console.log('📹 Stream started for clinic:', data.clinicId);
    });

    // 관리자가 카메라 켜기 요청
    socketIo.on('tablet:start-camera-request', () => {
      console.log('📹 Admin requested camera start');
      startCameraStream();
    });

    // 관리자가 카메라 끄기 요청
    socketIo.on('tablet:stop-camera-request', () => {
      console.log('🛑 Admin requested camera stop');
      stopCameraStream();
    });

    socketIo.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    return () => {
      socketIo.disconnect();
    };
  }, []);

  // clinicId 변경 시 소켓에 등록
  useEffect(() => {
    if (socket && clinicId) {
      socket.emit('tablet:register', { clinicId });
    }
  }, [socket, clinicId]);

  // 카메라 스트리밍 시작
  const startCameraStream = async () => {
    if (!clinicId) {
      alert('클리닉 ID가 설정되지 않았습니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Socket.io로 스트림 시작 알림
      if (socket) {
        socket.emit('tablet:start-stream', { clinicId });
        setIsStreaming(true);

        // 프레임 캡처 및 전송 시작 (초당 2프레임)
        streamIntervalRef.current = setInterval(() => {
          captureAndSendFrame();
        }, 500);
      }
    } catch (error: any) {
      console.error('카메라 접근 실패:', error);
      alert(`카메라 접근 실패: ${error.message}\n\n권한을 확인해주세요.`);
    }
  };

  // 프레임 캡처 및 전송
  const captureAndSendFrame = () => {
    if (!videoRef.current || !canvasRef.current || !socket || !clinicId) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // 비디오 크기에 맞춰 canvas 크기 설정
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 현재 프레임을 canvas에 그리기
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // canvas를 base64 이미지로 변환
    const frame = canvas.toDataURL('image/jpeg', 0.7);

    // Socket.io로 프레임 전송
    socket.emit('tablet:frame', { clinicId, frame });
  };

  // 카메라 스트리밍 중지
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    if (socket && clinicId) {
      socket.emit('tablet:stop-stream', { clinicId });
      setIsStreaming(false);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (qrPollingInterval) {
        clearInterval(qrPollingInterval);
      }
      // 카메라 스트리밍 정리
      stopCameraStream();
    };
  }, [qrPollingInterval]);

  // 출근/퇴근 선택
  const selectCheckType = (type: 'IN' | 'OUT') => {
    setCheckType(type);
    setStep('SELECT_METHOD');

    // QR 코드가 활성화되어 있으면 자동으로 생성
    if (availableMethods.includes('QR_CODE')) {
      generateQR(type); // type 전달
    }
  };

  // 인증 방법 선택
  const selectAuthMethod = (method: AuthMethod) => {
    setAuthMethod(method);

    // 생체인식은 바로 시작 (직원 선택 없이 자동 식별)
    if (method === 'BIOMETRIC') {
      handleBiometricAuth();
    } else {
      setStep('AUTH');
      // QR은 이미 selectCheckType에서 생성되었으므로 여기서는 생성하지 않음
    }
  };

  // QR 토큰 사용 여부 확인
  const checkQRTokenUsed = async (token: string) => {
    try {
      const response = await fetch(`/api/attendance/qr-token?token=${token}`);
      const result = await response.json();

      // 토큰이 유효하지 않으면 (사용됨 or 만료됨) 자동으로 초기화
      if (!result.success || !result.data?.valid) {
        console.log('QR 토큰 사용됨 또는 만료됨, 초기화합니다.');

        // Polling 중단
        if (qrPollingInterval) {
          clearInterval(qrPollingInterval);
          setQrPollingInterval(null);
        }

        // 초기화 (처음 화면으로 돌아가기)
        reset();
      }
    } catch (error) {
      console.error('QR 토큰 확인 실패:', error);
    }
  };

  // QR 코드 생성
  const generateQR = async (type?: 'IN' | 'OUT') => {
    const targetCheckType = type || checkType;

    try {
      const response = await fetch('/api/attendance/qr-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkType: targetCheckType,
          clinicId: clinicId // URL에서 받은 clinicId 전달
        }),
      });
      const result = await response.json();

      if (result.success && result.data) {
        const newToken = result.data.token;
        setQrToken(newToken);

        // 설정에 따라 URL 결정
        let baseUrl = window.location.origin; // 기본값: localhost

        if (useExternalUrl) {
          // 외부 URL 사용 설정이 활성화되어 있으면 환경변수 사용
          baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        }

        const url = `${baseUrl}/attendance/qr/${newToken}`;
        setQrUrl(url);

        console.log('QR URL 생성:', url, '(외부 URL 사용:', useExternalUrl, ')');

        // 기존 polling이 있으면 중단
        if (qrPollingInterval) {
          clearInterval(qrPollingInterval);
        }

        // 2초마다 QR 토큰 사용 여부 확인
        const interval = setInterval(() => {
          checkQRTokenUsed(newToken);
        }, 2000);

        setQrPollingInterval(interval);
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

      // 출퇴근 기록 ID 저장
      if (data.record?.id) {
        setAttendanceRecordId(data.record.id);
      }

      // 지각/조퇴/스케줄 외 출근 체크
      const needsReasonSubmit = data.isLate || data.isEarlyLeave || (checkType === 'IN' && !data.isScheduled);

      if (needsReasonSubmit) {
        setReasonInfo({
          isLate: data.isLate,
          lateMinutes: data.lateMinutes,
          isEarlyLeave: data.isEarlyLeave,
          earlyMinutes: data.earlyMinutes,
          isUnscheduled: checkType === 'IN' && !data.isScheduled,
        });
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

  // 생체인식 (지문/안면) - 직원 자동 식별
  const handleBiometricAuth = async () => {
    setLoading(true);

    try {
      // 1. Challenge 요청 (staffId 없이)
      const challengeResponse = await fetch('/api/attendance/check/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // staffId 없이 요청
      });

      const challengeData = await challengeResponse.json();

      if (!challengeData.success) {
        throw new Error(challengeData.error || 'Challenge 생성 실패');
      }

      const { options } = challengeData;

      // 2. WebAuthn 인증
      if (!window.PublicKeyCredential) {
        throw new Error('이 브라우저는 생체인식을 지원하지 않습니다.');
      }

      // allowCredentials의 id를 Uint8Array로 변환
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        timeout: options.timeout,
        rpId: options.rpId,
        allowCredentials: options.allowCredentials.map((cred: any) => ({
          type: cred.type,
          id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        })),
        userVerification: options.userVerification,
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('생체인식이 취소되었습니다.');
      }

      // 3. Credential을 서버로 전송하여 검증 (staffId 없이 - 자동 식별)
      const response = credential.response as AuthenticatorAssertionResponse;

      const credentialForServer = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        response: {
          authenticatorData: btoa(String.fromCharCode(...new Uint8Array(response.authenticatorData))),
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
          signature: btoa(String.fromCharCode(...new Uint8Array(response.signature))),
          userHandle: response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(response.userHandle))) : null,
        },
        type: credential.type,
      };

      const verifyResponse = await fetch('/api/attendance/check/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // staffId 제거 - 자동 식별
          credential: credentialForServer,
          challenge: options.challenge,
          checkType,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        throw new Error(verifyData.error || '생체인식 검증 실패');
      }

      // 출퇴근 기록 ID 저장
      if (verifyData.record?.id) {
        setAttendanceRecordId(verifyData.record.id);
      }

      // 지각/조퇴 확인
      if (verifyData.isLate || verifyData.isEarlyLeave) {
        setReasonInfo({
          isLate: verifyData.isLate,
          lateMinutes: verifyData.lateMinutes,
          isEarlyLeave: verifyData.isEarlyLeave,
          earlyMinutes: verifyData.earlyMinutes,
        });
        setNeedsReason(true);
        setStep('AUTH'); // 사유 입력 UI 표시
      } else {
        showCompletionMessage(verifyData);
      }
    } catch (error: any) {
      console.error('생체인식 오류:', error);
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

    if (!attendanceRecordId) {
      alert('출퇴근 기록을 찾을 수 없습니다.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/attendance/submit-reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: attendanceRecordId,
          reason: reason.trim(),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '사유 제출 실패');
      }

      showCompletionMessage({});
    } catch (error: any) {
      alert(error.message || '사유 제출에 실패했습니다.');
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
    // Polling 중단
    if (qrPollingInterval) {
      clearInterval(qrPollingInterval);
      setQrPollingInterval(null);
    }

    setStep('SELECT_TYPE');
    setCheckType(null);
    setAuthMethod(null);
    setSelectedStaffId('');
    setPinCode('');
    setNeedsReason(false);
    setReason('');
    setAttendanceRecordId(null);
    setReasonInfo({});
    setCompletionMessage(null);
    setQrToken('');
    setQrUrl('');
  };

  // 뒤로 가기
  const goBack = () => {
    // Polling 중단
    if (qrPollingInterval) {
      clearInterval(qrPollingInterval);
      setQrPollingInterval(null);
    }

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

  // 기기 진단 실행
  const runDiagnostics = async () => {
    console.log('🔍 기기 진단 시작...');

    const results = {
      webAuthnSupported: false,
      cameraAvailable: false,
      cameraPermission: 'unknown',
      mediaDevices: [] as MediaDeviceInfo[],
    };

    // 1. WebAuthn 지원 확인
    results.webAuthnSupported = !!(window.PublicKeyCredential && navigator.credentials);
    console.log('✅ WebAuthn 지원:', results.webAuthnSupported);

    // 2. MediaDevices API 확인
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        results.mediaDevices = devices;
        results.cameraAvailable = devices.some(device => device.kind === 'videoinput');
        console.log('📹 감지된 미디어 장치:', devices);
        console.log('📹 카메라 사용 가능:', results.cameraAvailable);
      } catch (error) {
        console.error('❌ 미디어 장치 열거 실패:', error);
      }
    }

    // 3. 카메라 권한 확인
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        results.cameraPermission = permission.state;
        console.log('🎥 카메라 권한 상태:', permission.state);
      } catch (error) {
        console.error('❌ 카메라 권한 확인 실패:', error);
        results.cameraPermission = 'unsupported';
      }
    }

    setDiagnosticResults(results);
  };

  // 카메라 테스트
  const testCamera = async () => {
    try {
      console.log('📹 카메라 스트림 요청 중...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      console.log('✅ 카메라 스트림 획득 성공');
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('❌ 카메라 접근 실패:', error);
      alert(`카메라 접근 실패: ${error.message}\n\n권한을 확인해주세요.`);
    }
  };

  // 카메라 스트림 정리
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      console.log('🛑 카메라 스트림 정지');
    }
  };

  // 진단 모드 정리
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

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

            {/* 2단계: 인증 방법 선택 (QR + 생체인식 동시 표시) */}
            {step === 'SELECT_METHOD' && (
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

                <div className="grid grid-cols-2 gap-6">
                  {/* 왼쪽: 생체인식 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-center mb-4">생체 인식</h3>

                    {availableMethods.includes('BIOMETRIC_FINGERPRINT') && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => selectAuthMethod('BIOMETRIC_FINGERPRINT')}
                        className="w-full h-32 text-xl flex-col"
                      >
                        <Fingerprint className="w-12 h-12 mb-2" />
                        <span>지문 인식</span>
                      </Button>
                    )}

                    {availableMethods.includes('BIOMETRIC_FACE') && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => selectAuthMethod('BIOMETRIC_FACE')}
                        className="w-full h-32 text-xl flex-col"
                      >
                        <Scan className="w-12 h-12 mb-2" />
                        <span>안면 인식</span>
                      </Button>
                    )}
                  </div>

                  {/* 오른쪽: QR 코드 */}
                  {availableMethods.includes('QR_CODE') && (
                    <div className="flex flex-col items-center justify-center border-l-2 border-gray-200 pl-6">
                      <h3 className="text-lg font-semibold mb-4">QR 코드 스캔</h3>
                      {qrUrl ? (
                        <div className="bg-white p-4 rounded-lg shadow-md">
                          <QRCodeCanvas value={qrUrl} size={200} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center w-[200px] h-[200px] bg-gray-100 rounded-lg">
                          <p className="text-gray-500">QR 생성 중...</p>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-4 text-center">
                        스마트폰으로 QR 코드를<br />스캔해주세요
                      </p>
                    </div>
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
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                          <p className="text-lg font-semibold text-amber-900 mb-2">
                            사유 제출이 필요합니다
                          </p>
                          <div className="space-y-1 text-amber-800">
                            {reasonInfo.isUnscheduled && (
                              <p>• 스케줄에 없는 근무</p>
                            )}
                            {reasonInfo.isLate && (
                              <p>• 지각: {reasonInfo.lateMinutes}분</p>
                            )}
                            {reasonInfo.isEarlyLeave && (
                              <p>• 조퇴: {reasonInfo.earlyMinutes}분</p>
                            )}
                          </div>
                        </div>
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

                {/* 생체인식 인증 - 사유 입력만 */}
                {(authMethod === 'BIOMETRIC_FINGERPRINT' || authMethod === 'BIOMETRIC_FACE') && (
                  <div className="space-y-6">
                    {needsReason ? (
                      <div>
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
                          <p className="text-lg font-semibold text-amber-900 mb-2">
                            사유 제출이 필요합니다
                          </p>
                          <div className="space-y-1 text-amber-800">
                            {reasonInfo.isLate && (
                              <p>• 지각: {reasonInfo.lateMinutes}분</p>
                            )}
                            {reasonInfo.isEarlyLeave && (
                              <p>• 조퇴: {reasonInfo.earlyMinutes}분</p>
                            )}
                          </div>
                        </div>
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
                      <div className="text-center">
                        {authMethod === 'BIOMETRIC_FINGERPRINT' ? (
                          <Fingerprint className="w-24 h-24 mx-auto text-blue-600 mb-4 animate-pulse" />
                        ) : (
                          <Scan className="w-24 h-24 mx-auto text-blue-600 mb-4 animate-pulse" />
                        )}
                        <p className="text-xl mb-4">
                          {loading ? '생체인식 진행 중...' : '생체인식 완료'}
                        </p>
                      </div>
                    )}
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

          {/* 기기 진단 버튼 */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowDiagnostics(!showDiagnostics);
                if (!showDiagnostics && !diagnosticResults) {
                  runDiagnostics();
                }
              }}
              className="w-full"
            >
              {showDiagnostics ? '진단 닫기' : '🔧 기기 진단'}
            </Button>
          </div>
        </Card>

        {/* 기기 진단 패널 */}
        {showDiagnostics && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 기기 진단 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {diagnosticResults ? (
                <>
                  {/* WebAuthn 지원 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">WebAuthn API (생체인식)</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${diagnosticResults.webAuthnSupported ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {diagnosticResults.webAuthnSupported ? '✅ 지원됨' : '❌ 지원 안됨'}
                    </span>
                  </div>

                  {/* 카메라 감지 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">카메라 감지</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${diagnosticResults.cameraAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {diagnosticResults.cameraAvailable ? '✅ 감지됨' : '❌ 없음'}
                    </span>
                  </div>

                  {/* 카메라 권한 */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">카메라 권한</span>
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      diagnosticResults.cameraPermission === 'granted'
                        ? 'bg-green-100 text-green-800'
                        : diagnosticResults.cameraPermission === 'denied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {diagnosticResults.cameraPermission === 'granted' && '✅ 허용됨'}
                      {diagnosticResults.cameraPermission === 'denied' && '❌ 거부됨'}
                      {diagnosticResults.cameraPermission === 'prompt' && '⚠️ 요청 필요'}
                      {diagnosticResults.cameraPermission === 'unsupported' && '❌ 미지원'}
                      {diagnosticResults.cameraPermission === 'unknown' && '❓ 알 수 없음'}
                    </span>
                  </div>

                  {/* 미디어 장치 목록 */}
                  {diagnosticResults.mediaDevices.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">감지된 미디어 장치 ({diagnosticResults.mediaDevices.length}개)</h4>
                      <ul className="text-sm space-y-1">
                        {diagnosticResults.mediaDevices.map((device, index) => (
                          <li key={index} className="text-gray-700">
                            {device.kind === 'videoinput' && '📹 '}
                            {device.kind === 'audioinput' && '🎤 '}
                            {device.kind === 'audiooutput' && '🔊 '}
                            {device.label || `${device.kind} #${index + 1}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 카메라 테스트 */}
                  <div className="space-y-3">
                    <Button
                      onClick={cameraStream ? stopCamera : testCamera}
                      variant={cameraStream ? 'destructive' : 'default'}
                      className="w-full"
                    >
                      {cameraStream ? '🛑 카메라 중지' : '📹 카메라 테스트'}
                    </Button>

                    {cameraStream && (
                      <div className="relative rounded-lg overflow-hidden bg-black">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full"
                        />
                        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-sm">
                          ● 실시간
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 도움말 */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <p className="font-medium text-blue-900 mb-2">💡 문제 해결 방법:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-800">
                      <li>WebAuthn 미지원: 최신 브라우저 사용 (Chrome, Edge, Safari)</li>
                      <li>카메라 없음: 카메라가 연결되어 있는지 확인</li>
                      <li>권한 거부됨: 브라우저 설정에서 카메라 권한 허용</li>
                      <li>HTTPS 필요: 로컬호스트가 아닌 경우 HTTPS 사용 필요</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  진단 실행 중...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
