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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, Users, AlertTriangle, CheckCircle, XCircle, QrCode, Fingerprint, Copy, Check, Tablet, UserCheck, CalendarCheck, LogIn, LogOut, Settings, Scan, FileText, Filter, Search, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface StaffMember {
  id: string;
  name: string;
  rank: string;
  departmentName: string;
  shiftType?: string | null;
  isScheduled?: boolean;
  useSchedule?: boolean;
  isCheckedIn?: boolean;
  isCheckedOut?: boolean;
  isPresent?: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyMinutes?: number;
  notes?: string;
  isSubstitute?: boolean;
  substituteForStaff?: {
    id: string;
    name: string;
    rank: string;
    departmentName: string;
  } | null;
  substitutedAt?: string;
}

interface TodayStats {
  date: string;
  summary: {
    totalStaff: number;
    totalScheduled: number;
    totalNonScheduled: number;
    totalCheckedIn: number;
    totalCheckedOut: number;
    currentlyPresent: number;
    notYetCheckedIn: number;
    suspiciousCount: number;
    lateCount: number;
    earlyLeaveCount: number;
    checkInRate: string;
  };
  scheduledStaffList: StaffMember[];
  checkedInStaffList: StaffMember[];
  notCheckedInList: StaffMember[];
  byDepartment: Array<{
    department: string;
    total: number;
    useSchedule: boolean;
    scheduled: number;
    checkedIn: number;
    present: number;
    checkInRate: string;
  }>;
}

interface ReasonRecord {
  id: string;
  staffId: string;
  staffName: string;
  departmentName: string;
  checkType: 'IN' | 'OUT';
  checkTime: string;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyMinutes: number;
  notes: string;
}

export default function AttendanceDashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricUrl, setBiometricUrl] = useState<string>('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tabletUrl, setTabletUrl] = useState<string>('');
  const [copiedTablet, setCopiedTablet] = useState(false);

  // 날짜 선택 state (YYYY-MM-DD 형식)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const kstOffset = 9 * 60; // KST는 UTC+9
    const kstNow = new Date(now.getTime() + kstOffset * 60 * 1000);
    return kstNow.toISOString().split('T')[0];
  });

  // 출퇴근 체크 방법 설정
  const [checkMethods, setCheckMethods] = useState({
    qrCode: true,
    fingerprint: true,
    face: true,
  });
  const [savingMethods, setSavingMethods] = useState(false);

  // 사유서 관련 state
  const [reasonRecords, setReasonRecords] = useState<ReasonRecord[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<'ALL' | 'LATE' | 'EARLY'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 대체 근무 관련 state
  const [substituteModalOpen, setSubstituteModalOpen] = useState(false);
  const [substituteStaff, setSubstituteStaff] = useState<StaffMember | null>(null);
  const [selectedOriginalStaffId, setSelectedOriginalStaffId] = useState<string>('');
  const [processingSubstitute, setProcessingSubstitute] = useState(false);

  // 출퇴근 체크 방법 설정 로드
  useEffect(() => {
    const fetchCheckMethods = async () => {
      try {
        const response = await fetch('/api/attendance/settings');
        const result = await response.json();

        if (result.success && result.data) {
          const methods = result.data.methods || [];
          setCheckMethods({
            qrCode: methods.includes('QR_CODE'),
            fingerprint: methods.includes('BIOMETRIC_FINGERPRINT'),
            face: methods.includes('BIOMETRIC_FACE'),
          });
        }
      } catch (error) {
        console.error('Failed to fetch check methods:', error);
      }
    };

    fetchCheckMethods();
  }, []);

  useEffect(() => {
    const fetchTodayStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/attendance/today-stats?date=${selectedDate}`);
        const result = await response.json();

        if (result.success && result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch today stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayStats();

    // 30초마다 자동 새로고침
    const interval = setInterval(fetchTodayStats, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // 사유서 데이터 로드
  useEffect(() => {
    const fetchReasonRecords = async () => {
      try {
        setLoadingReasons(true);
        const response = await fetch(`/api/attendance/reasons?date=${selectedDate}`);
        const result = await response.json();

        if (result.success && result.data) {
          setReasonRecords(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch reason records:', error);
      } finally {
        setLoadingReasons(false);
      }
    };

    fetchReasonRecords();

    // 30초마다 자동 새로고침
    const interval = setInterval(fetchReasonRecords, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  // 생체인식 등록 URL 생성
  const generateBiometricUrl = async () => {
    setLoadingUrl(true);
    try {
      const response = await fetch('/api/deploy/biometric-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();

      if (result.success && result.data?.publicUrl) {
        setBiometricUrl(result.data.publicUrl);
        toast({
          title: 'URL 생성 완료',
          description: '생체인식 등록 URL이 생성되었습니다.',
        });
      } else {
        throw new Error(result.error || 'URL 생성 실패');
      }
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || 'URL 생성에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoadingUrl(false);
    }
  };

  // URL 복사
  const copyBiometricUrl = async () => {
    if (!biometricUrl) {
      await generateBiometricUrl();
      return;
    }

    try {
      await navigator.clipboard.writeText(biometricUrl);
      setCopied(true);
      toast({
        title: '복사 완료',
        description: '생체인식 등록 URL이 클립보드에 복사되었습니다.',
      });

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 태블릿 URL 생성
  const generateTabletUrl = () => {
    const url = `${window.location.origin}/tablet/attendance`;
    setTabletUrl(url);
    toast({
      title: 'URL 생성 완료',
      description: '태블릿 출퇴근 체크 URL이 생성되었습니다.',
    });
  };

  // 태블릿 URL 복사
  const copyTabletUrl = async () => {
    if (!tabletUrl) {
      generateTabletUrl();
      // URL 생성 후 약간의 지연을 두고 복사
      setTimeout(async () => {
        try {
          const url = `${window.location.origin}/tablet/attendance`;
          await navigator.clipboard.writeText(url);
          setCopiedTablet(true);
          toast({
            title: '복사 완료',
            description: '태블릿 출퇴근 체크 URL이 클립보드에 복사되었습니다.',
          });

          setTimeout(() => {
            setCopiedTablet(false);
          }, 2000);
        } catch (error) {
          toast({
            title: '복사 실패',
            description: '클립보드 복사에 실패했습니다.',
            variant: 'destructive',
          });
        }
      }, 100);
      return;
    }

    try {
      await navigator.clipboard.writeText(tabletUrl);
      setCopiedTablet(true);
      toast({
        title: '복사 완료',
        description: '태블릿 출퇴근 체크 URL이 클립보드에 복사되었습니다.',
      });

      setTimeout(() => {
        setCopiedTablet(false);
      }, 2000);
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 대체 근무 모달 열기
  const openSubstituteModal = (staff: StaffMember) => {
    setSubstituteStaff(staff);
    setSelectedOriginalStaffId('');
    setSubstituteModalOpen(true);
  };

  // 대체 근무 처리
  const handleSubstituteWork = async () => {
    if (!substituteStaff || !selectedOriginalStaffId) {
      toast({
        title: '오류',
        description: '대체할 직원을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setProcessingSubstitute(true);
    try {
      const response = await fetch('/api/schedule/substitute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          substituteStaffId: substituteStaff.id,
          originalStaffId: selectedOriginalStaffId,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '대체 근무 처리 실패');
      }

      toast({
        title: '처리 완료',
        description: `${result.data.substitute.name}님이 ${result.data.original.name}님을 대체하여 근무합니다.`,
      });

      // 모달 닫고 데이터 새로고침
      setSubstituteModalOpen(false);
      setSubstituteStaff(null);
      setSelectedOriginalStaffId('');

      // 통계 데이터 새로고침
      const statsResponse = await fetch(`/api/attendance/today-stats?date=${selectedDate}`);
      const statsResult = await statsResponse.json();
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error: any) {
      toast({
        title: '처리 실패',
        description: error.message || '대체 근무 처리에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setProcessingSubstitute(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">출퇴근 관리</h1>
          <p className="text-gray-600">
            직원들의 출퇴근 현황을 확인하고 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="date-select" className="text-sm font-medium">조회 날짜:</Label>
          <input
            id="date-select"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            출퇴근 현황
          </TabsTrigger>
          <TabsTrigger value="reasons" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            사유서
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            설정
          </TabsTrigger>
        </TabsList>

        {/* 출퇴근 현황 탭 */}
        <TabsContent value="status" className="space-y-6">
          {/* 오늘의 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">출근 대상</p>
                    <p className="text-3xl font-bold">{stats?.summary.totalStaff || 0}명</p>
                  </div>
                  <CalendarCheck className="w-10 h-10 text-gray-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">출근</p>
                    <p className="text-3xl font-bold text-green-600">{stats?.summary.totalCheckedIn || 0}명</p>
                    {stats?.summary.lateCount > 0 && (
                      <p className="text-xs text-red-600 mt-1">지각 {stats.summary.lateCount}명</p>
                    )}
                  </div>
                  <LogIn className="w-10 h-10 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">현재 근무 중</p>
                    <p className="text-3xl font-bold text-blue-600">{stats?.summary.currentlyPresent || 0}명</p>
                  </div>
                  <UserCheck className="w-10 h-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">미출근</p>
                    <p className="text-3xl font-bold text-amber-600">{stats?.summary.notYetCheckedIn || 0}명</p>
                  </div>
                  <XCircle className="w-10 h-10 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">퇴근</p>
                    <p className="text-3xl font-bold text-gray-600">{stats?.summary.totalCheckedOut || 0}명</p>
                    {stats?.summary.earlyLeaveCount > 0 && (
                      <p className="text-xs text-red-600 mt-1">조퇴 {stats.summary.earlyLeaveCount}명</p>
                    )}
                  </div>
                  <LogOut className="w-10 h-10 text-gray-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 의심 패턴 경고 */}
          {stats && stats.summary.suspiciousCount > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <AlertTriangle className="w-5 h-5" />
                  의심 패턴 감지
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-amber-800 mb-3">
                  {stats.summary.suspiciousCount}건의 의심스러운 출퇴근 기록이 감지되었습니다
                </p>
                <Link href="/attendance/history">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-900">
                    자세히 보기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 출근 대상 직원 명단 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                출근 대상 직원
                <Badge variant="outline" className="ml-2">
                  총 {stats?.scheduledStaffList?.length || 0}명
                </Badge>
                {stats?.summary.totalScheduled && stats.summary.totalScheduled > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-700">
                    스케줄 부서: {stats.summary.totalScheduled}명
                  </Badge>
                )}
                {stats?.summary.totalNonScheduled && stats.summary.totalNonScheduled > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">
                    비스케줄 부서: {stats.summary.totalNonScheduled}명
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : stats && stats.scheduledStaffList && stats.scheduledStaffList.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {/* 부서별로 그룹화 */}
                  {Object.entries(
                    stats.scheduledStaffList.reduce((acc, staff) => {
                      const dept = staff.departmentName || '미지정';
                      if (!acc[dept]) acc[dept] = [];
                      acc[dept].push(staff);
                      return acc;
                    }, {} as Record<string, StaffMember[]>)
                  )
                    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
                    .map(([department, staffList]) => (
                      <div key={department} className="border rounded-lg p-3 bg-white">
                        <h3 className="font-semibold text-sm text-gray-700 mb-2 pb-2 border-b flex items-center justify-between">
                          <span>{department}</span>
                          <Badge variant="outline" className="text-xs">
                            {staffList.length}명
                          </Badge>
                        </h3>
                        <div className="space-y-2">
                          {staffList.map((staff, index) => (
                            <div
                              key={`scheduled-${staff.id}-${index}`}
                              className={`p-3 rounded-lg border ${
                                staff.isPresent
                                  ? 'bg-green-50 border-green-200'
                                  : staff.isCheckedIn
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{staff.name || '이름 없음'}</span>
                                  {staff.rank && <span className="text-xs text-gray-500">({staff.rank})</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {staff.isPresent ? (
                                    <Badge className="bg-green-600 text-xs">
                                      <UserCheck className="w-3 h-3 mr-1" />
                                      근무 중
                                    </Badge>
                                  ) : staff.isCheckedOut ? (
                                    <Badge variant="outline" className="text-gray-600 text-xs">
                                      <LogOut className="w-3 h-3 mr-1" />
                                      퇴근
                                    </Badge>
                                  ) : staff.isCheckedIn ? (
                                    <Badge className="bg-blue-600 text-xs">
                                      <LogIn className="w-3 h-3 mr-1" />
                                      출근
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      미출근
                                    </Badge>
                                  )}
                                  {staff.isSubstitute && staff.substituteForStaff && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-100 border-blue-300 text-blue-800 text-xs"
                                      title={`${staff.substituteForStaff.name}님 대신 근무 (${staff.substitutedAt ? new Date(staff.substitutedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''})`}
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      {staff.substituteForStaff.name} 대신
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {/* 출퇴근 시간 및 지각/조퇴 정보 */}
                              {(staff.checkInTime || staff.checkOutTime) && (
                                <div className="text-xs text-gray-600 space-y-1">
                                  {staff.checkInTime && (
                                    <div className="flex items-center gap-2">
                                      <span>출근: {new Date(staff.checkInTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      {staff.isLate && (
                                        <Badge variant="destructive" className="text-xs px-1 py-0">
                                          지각 {staff.lateMinutes}분
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {staff.checkOutTime && (
                                    <div className="flex items-center gap-2">
                                      <span>퇴근: {new Date(staff.checkOutTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                                      {staff.isEarlyLeave && (
                                        <Badge variant="destructive" className="text-xs px-1 py-0">
                                          조퇴 {staff.earlyMinutes}분
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                  {staff.notes && (
                                    <div className="text-gray-500 italic">
                                      사유: {staff.notes}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  등록된 직원이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 출근한 인원 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                출근한 인원
                <Badge variant="outline" className="ml-2">
                  {stats?.checkedInStaffList?.length || 0}명
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : stats && stats.checkedInStaffList && stats.checkedInStaffList.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {stats.checkedInStaffList.map((staff, index) => (
                    <div
                      key={`checkedin-${staff.id}-${index}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        staff.isPresent
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{staff.name || '이름 없음'}</span>
                            {staff.rank && <span className="text-sm text-gray-500">({staff.rank})</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{staff.departmentName || '부서 없음'}</span>
                            {staff.checkTime && (
                              <>
                                <span>•</span>
                                <span>
                                  {new Date(staff.checkTime).toLocaleTimeString('ko-KR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {staff.isPresent ? (
                          <Badge className="bg-green-600">
                            <UserCheck className="w-3 h-3 mr-1" />
                            근무 중
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            <LogOut className="w-3 h-3 mr-1" />
                            퇴근
                          </Badge>
                        )}
                        {!staff.isScheduled && staff.isPresent && (
                          <Badge
                            variant="outline"
                            className="bg-amber-100 border-amber-300 text-amber-800 cursor-pointer hover:bg-amber-200 transition"
                            onClick={() => openSubstituteModal(staff)}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            대체 근무
                          </Badge>
                        )}
                        {staff.isSubstitute && staff.substituteForStaff && (
                          <Badge
                            variant="outline"
                            className="bg-blue-100 border-blue-300 text-blue-800"
                            title={`${staff.substituteForStaff.name}님 대신 근무 (${staff.substitutedAt ? new Date(staff.substitutedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''})`}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {staff.substituteForStaff.name} 대신
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  출근한 인원이 없습니다
                </div>
              )}
            </CardContent>
          </Card>

          {/* 부서별 출근 현황 */}
          {stats && stats.byDepartment && stats.byDepartment.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  부서별 출근 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.byDepartment.map((dept, index) => (
                    <div key={`dept-${dept.department}-${index}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{dept.department || '부서 없음'}</h3>
                          {dept.useSchedule ? (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              스케줄 사용
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                              비스케줄
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline">
                          출근률 {dept.checkInRate || '0.0'}%
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">대상:</span>
                          <span className="ml-1 font-medium">{dept.total}명</span>
                        </div>
                        <div>
                          <span className="text-gray-600">출근:</span>
                          <span className="ml-1 font-medium text-green-600">{dept.checkedIn}명</span>
                        </div>
                        <div>
                          <span className="text-gray-600">근무 중:</span>
                          <span className="ml-1 font-medium text-blue-600">{dept.present}명</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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

            <Link href="/tablet/attendance" target="_blank">
              <Card className="hover:bg-gray-50 transition cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Tablet className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                  <h3 className="font-semibold">태블릿 페이지</h3>
                  <p className="text-sm text-gray-500">출퇴근 체크 페이지</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </TabsContent>

        {/* 사유서 탭 */}
        <TabsContent value="reasons" className="space-y-6">
          {/* 필터 영역 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                필터
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 타입 필터 */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">사유 유형</Label>
                  <select
                    value={reasonFilter}
                    onChange={(e) => setReasonFilter(e.target.value as 'ALL' | 'LATE' | 'EARLY')}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">전체</option>
                    <option value="LATE">지각</option>
                    <option value="EARLY">조퇴</option>
                  </select>
                </div>

                {/* 부서 필터 */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">부서</Label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">전체 부서</option>
                    {Array.from(new Set(reasonRecords.map(r => r.departmentName))).map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* 검색 */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">직원 검색</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="이름으로 검색"
                      className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 사유서 목록 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                제출된 사유서
                <Badge variant="outline" className="ml-2">
                  {(() => {
                    let filtered = reasonRecords;

                    if (reasonFilter === 'LATE') {
                      filtered = filtered.filter(r => r.isLate);
                    } else if (reasonFilter === 'EARLY') {
                      filtered = filtered.filter(r => r.isEarlyLeave);
                    }

                    if (departmentFilter !== 'ALL') {
                      filtered = filtered.filter(r => r.departmentName === departmentFilter);
                    }

                    if (searchQuery.trim()) {
                      filtered = filtered.filter(r => r.staffName.includes(searchQuery.trim()));
                    }

                    return filtered.length;
                  })()}건
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReasons ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : (() => {
                let filtered = reasonRecords;

                if (reasonFilter === 'LATE') {
                  filtered = filtered.filter(r => r.isLate);
                } else if (reasonFilter === 'EARLY') {
                  filtered = filtered.filter(r => r.isEarlyLeave);
                }

                if (departmentFilter !== 'ALL') {
                  filtered = filtered.filter(r => r.departmentName === departmentFilter);
                }

                if (searchQuery.trim()) {
                  filtered = filtered.filter(r => r.staffName.includes(searchQuery.trim()));
                }

                return filtered.length > 0 ? (
                  <div className="space-y-4 max-h-[700px] overflow-y-auto">
                    {filtered.map((record, index) => (
                      <div
                        key={`reason-${record.id}-${index}`}
                        className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-base">{record.staffName}</span>
                                <Badge variant="outline" className="text-xs">
                                  {record.departmentName}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span>
                                  {record.checkType === 'IN' ? '출근' : '퇴근'}
                                </span>
                                <span>•</span>
                                <span>
                                  {new Date(record.checkTime).toLocaleString('ko-KR', {
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {record.isLate && (
                              <Badge variant="destructive" className="text-xs">
                                지각 {record.lateMinutes}분
                              </Badge>
                            )}
                            {record.isEarlyLeave && (
                              <Badge variant="destructive" className="text-xs">
                                조퇴 {record.earlyMinutes}분
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <FileText className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-amber-900 mb-1">제출 사유</p>
                              <p className="text-sm text-amber-800 whitespace-pre-wrap">
                                {record.notes}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium mb-1">제출된 사유서가 없습니다</p>
                    <p className="text-sm">지각 또는 조퇴 시 사유서가 제출됩니다</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 설정 탭 */}
        <TabsContent value="settings" className="space-y-6">
          <div className="max-w-3xl space-y-6">
            {/* 생체인식 등록 URL */}
            <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-indigo-600" />
                  <span className="text-indigo-900">생체인식 등록 URL</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    직원들이 지문 또는 안면 인식을 등록할 수 있는 URL입니다.
                    이 링크를 직원들에게 공유하면 각자 생체인식을 등록할 수 있습니다.
                  </p>

                  {biometricUrl && (
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200">
                      <code className="flex-1 text-sm text-gray-700 overflow-x-auto">
                        {biometricUrl}
                      </code>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={generateBiometricUrl}
                      disabled={loadingUrl}
                      variant="outline"
                      className="flex-1"
                    >
                      <Fingerprint className="w-4 h-4 mr-2" />
                      {loadingUrl ? 'URL 생성 중...' : biometricUrl ? 'URL 재생성' : 'URL 생성'}
                    </Button>

                    <Button
                      onClick={copyBiometricUrl}
                      disabled={loadingUrl || (!biometricUrl && !loadingUrl)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          복사 완료!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          URL 복사
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 태블릿 출퇴근 체크 URL */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tablet className="w-5 h-5 text-green-600" />
                  <span className="text-green-900">태블릿 출퇴근 체크 URL</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-gray-700">
                    태블릿이나 비치용 기기에 설정하여 직원들이 출퇴근을 체크할 수 있는 페이지입니다.
                    전체화면 모드로 사용하면 편리합니다.
                  </p>

                  {tabletUrl && (
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-green-200">
                      <code className="flex-1 text-sm text-gray-700 overflow-x-auto">
                        {tabletUrl}
                      </code>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={generateTabletUrl}
                      variant="outline"
                      className="flex-1"
                    >
                      <Tablet className="w-4 h-4 mr-2" />
                      {tabletUrl ? 'URL 재생성' : 'URL 생성'}
                    </Button>

                    <Button
                      onClick={copyTabletUrl}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {copiedTablet ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          복사 완료!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          URL 복사
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 출퇴근 체크 방법 설정 */}
            <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  <span className="text-purple-900">출퇴근 체크 방법 설정</span>
                </CardTitle>
                <CardDescription>
                  태블릿 출퇴근 페이지에서 사용할 인증 방법을 선택하세요. 최소 1개 이상 선택해야 합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* QR코드 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <QrCode className="w-5 h-5 text-purple-600" />
                      <div>
                        <Label htmlFor="qr-code" className="text-base font-medium cursor-pointer">
                          QR 코드
                        </Label>
                        <p className="text-sm text-gray-500">
                          QR 코드 스캔으로 출퇴근 체크
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="qr-code"
                      checked={checkMethods.qrCode}
                      onCheckedChange={(checked) => {
                        // 최소 1개는 선택되어야 함
                        const otherMethodsCount = (checkMethods.fingerprint ? 1 : 0) + (checkMethods.face ? 1 : 0);
                        if (!checked && otherMethodsCount === 0) {
                          toast({
                            title: '오류',
                            description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setCheckMethods(prev => ({ ...prev, qrCode: checked }));
                      }}
                      disabled={savingMethods}
                    />
                  </div>

                  {/* 지문 인식 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-5 h-5 text-purple-600" />
                      <div>
                        <Label htmlFor="fingerprint" className="text-base font-medium cursor-pointer">
                          지문 인식
                        </Label>
                        <p className="text-sm text-gray-500">
                          생체인식 (지문)으로 출퇴근 체크
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="fingerprint"
                      checked={checkMethods.fingerprint}
                      onCheckedChange={(checked) => {
                        const otherMethodsCount = (checkMethods.qrCode ? 1 : 0) + (checkMethods.face ? 1 : 0);
                        if (!checked && otherMethodsCount === 0) {
                          toast({
                            title: '오류',
                            description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setCheckMethods(prev => ({ ...prev, fingerprint: checked }));
                      }}
                      disabled={savingMethods}
                    />
                  </div>

                  {/* 안면 인식 */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Scan className="w-5 h-5 text-purple-600" />
                      <div>
                        <Label htmlFor="face" className="text-base font-medium cursor-pointer">
                          안면 인식
                        </Label>
                        <p className="text-sm text-gray-500">
                          생체인식 (안면)으로 출퇴근 체크
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="face"
                      checked={checkMethods.face}
                      onCheckedChange={(checked) => {
                        const otherMethodsCount = (checkMethods.qrCode ? 1 : 0) + (checkMethods.fingerprint ? 1 : 0);
                        if (!checked && otherMethodsCount === 0) {
                          toast({
                            title: '오류',
                            description: '최소 1개 이상의 체크 방법을 선택해야 합니다.',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setCheckMethods(prev => ({ ...prev, face: checked }));
                      }}
                      disabled={savingMethods}
                    />
                  </div>

                  {/* 저장 버튼 */}
                  <Button
                    onClick={async () => {
                      setSavingMethods(true);
                      try {
                        const methods = [];
                        if (checkMethods.qrCode) methods.push('QR_CODE');
                        if (checkMethods.fingerprint) methods.push('BIOMETRIC_FINGERPRINT');
                        if (checkMethods.face) methods.push('BIOMETRIC_FACE');

                        const response = await fetch('/api/attendance/settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ methods }),
                        });

                        const result = await response.json();
                        if (!result.success) {
                          throw new Error(result.error || '저장 실패');
                        }

                        toast({
                          title: '저장 완료',
                          description: '출퇴근 체크 방법 설정이 저장되었습니다.',
                        });
                      } catch (error: any) {
                        toast({
                          title: '저장 실패',
                          description: error.message || '설정 저장에 실패했습니다.',
                          variant: 'destructive',
                        });
                      } finally {
                        setSavingMethods(false);
                      }
                    }}
                    disabled={savingMethods}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {savingMethods ? '저장 중...' : '설정 저장'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 대체 근무 선택 모달 */}
      <Dialog open={substituteModalOpen} onOpenChange={setSubstituteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              대체 근무 처리
            </DialogTitle>
            <DialogDescription>
              {substituteStaff && (
                <span className="font-semibold text-base text-gray-900">
                  {substituteStaff.name}({substituteStaff.departmentName})
                </span>
              )}
              님이 누구를 대체하여 근무하시나요?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 안 온 직원 목록 (스케줄에 있지만 출근하지 않은) */}
            {stats && stats.notCheckedInList && stats.notCheckedInList.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">미출근 직원 선택</Label>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {stats.notCheckedInList.map((staff) => (
                    <div
                      key={staff.id}
                      onClick={() => setSelectedOriginalStaffId(staff.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        selectedOriginalStaffId === staff.id
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200'
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{staff.name}</span>
                            {staff.rank && (
                              <span className="text-sm text-gray-500">({staff.rank})</span>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {staff.departmentName}
                            </Badge>
                          </div>
                          {staff.shiftType && (
                            <div className="text-xs text-gray-500 mt-1">
                              근무 예정: {staff.shiftType === 'DAY' ? '주간' : staff.shiftType === 'NIGHT' ? '야간' : staff.shiftType}
                            </div>
                          )}
                        </div>
                        {selectedOriginalStaffId === staff.id && (
                          <div className="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>미출근 직원이 없습니다</p>
                <p className="text-sm">모든 근무 예정자가 출근했습니다</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSubstituteModalOpen(false);
                setSubstituteStaff(null);
                setSelectedOriginalStaffId('');
              }}
              disabled={processingSubstitute}
            >
              <X className="w-4 h-4 mr-2" />
              취소
            </Button>
            <Button
              onClick={handleSubstituteWork}
              disabled={!selectedOriginalStaffId || processingSubstitute}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processingSubstitute ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  대체 근무 확정
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
