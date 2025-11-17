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
import { Clock, Users, AlertTriangle, CheckCircle, XCircle, QrCode, Fingerprint, Copy, Check, Tablet, UserCheck, CalendarCheck, LogIn, LogOut, Settings, Scan } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

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
  checkTime?: string;
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

export default function AttendanceDashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricUrl, setBiometricUrl] = useState<string>('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tabletUrl, setTabletUrl] = useState<string>('');
  const [copiedTablet, setCopiedTablet] = useState(false);

  // 출퇴근 체크 방법 설정
  const [checkMethods, setCheckMethods] = useState({
    qrCode: true,
    fingerprint: true,
    face: true,
  });
  const [savingMethods, setSavingMethods] = useState(false);

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
        const response = await fetch('/api/attendance/today-stats');
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
  }, []);

  // 생체인식 등록 URL 생성
  const generateBiometricUrl = async () => {
    setLoadingUrl(true);
    try {
      const response = await fetch('/api/leave-apply/token');
      const result = await response.json();

      if (result.success && result.token) {
        const url = `${window.location.origin}/biometric-setup/${result.token}`;
        setBiometricUrl(url);
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">출퇴근 관리</h1>
        <p className="text-gray-600">
          직원들의 실시간 출퇴근 현황을 확인하고 관리합니다
        </p>
      </div>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            출퇴근 현황
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            설정
          </TabsTrigger>
        </TabsList>

        {/* 출퇴근 현황 탭 */}
        <TabsContent value="status" className="space-y-6">
          {/* 오늘의 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                              className={`flex items-center justify-between p-2 rounded-lg border ${
                                staff.isPresent
                                  ? 'bg-green-50 border-green-200'
                                  : staff.isCheckedIn
                                  ? 'bg-blue-50 border-blue-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
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
                              </div>
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
                      <div>
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
    </div>
  );
}
