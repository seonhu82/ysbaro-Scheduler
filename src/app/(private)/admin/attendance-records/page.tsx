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
import {
  Calendar,
  Download,
  Filter,
  Trash2,
  UserPlus,
  BarChart3,
  Clock,
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  checkType: 'IN' | 'OUT';
  checkMethod: 'BIOMETRIC' | 'PIN' | 'QR' | 'MANUAL';
  checkTime: string;
  notes?: string;
  staff: {
    id: string;
    name: string;
    departmentName: string;
  };
}

interface Statistics {
  total: number;
  checkIn: number;
  checkOut: number;
  biometric: number;
  pin: number;
  qr: number;
  manual: number;
}

export default function AttendanceRecordsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [filterStaffId, setFilterStaffId] = useState('');
  const [filterCheckType, setFilterCheckType] = useState('');
  const [filterCheckMethod, setFilterCheckMethod] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [startDate, endDate, filterStaffId, filterCheckType, filterCheckMethod]);

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (filterStaffId) params.append('staffId', filterStaffId);
      if (filterCheckType) params.append('checkType', filterCheckType);
      if (filterCheckMethod) params.append('checkMethod', filterCheckMethod);

      const response = await fetch(`/api/attendance/records?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setRecords(data.records);
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('기록 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/attendance/records?recordId=${recordId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        alert('기록이 삭제되었습니다.');
        fetchRecords();
      }
    } catch (error) {
      console.error('기록 삭제 실패:', error);
      alert('기록 삭제에 실패했습니다.');
    }
  };

  const handleExportCSV = () => {
    const headers = ['날짜', '시간', '직원명', '부서', '구분', '방법', '비고'];
    const rows = records.map((record) => [
      new Date(record.checkTime).toLocaleDateString('ko-KR'),
      new Date(record.checkTime).toLocaleTimeString('ko-KR'),
      record.staff.name,
      record.staff.departmentName,
      record.checkType === 'IN' ? '출근' : '퇴근',
      getMethodText(record.checkMethod),
      record.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `출퇴근기록_${startDate}_${endDate}.csv`;
    link.click();
  };

  const getMethodText = (method: string) => {
    switch (method) {
      case 'BIOMETRIC':
        return '생체인증';
      case 'PIN':
        return 'PIN';
      case 'QR':
        return 'QR코드';
      case 'MANUAL':
        return '수동입력';
      default:
        return method;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">출퇴근 기록 관리</h1>
        <p className="text-gray-600">직원들의 출퇴근 기록을 조회하고 관리합니다.</p>
      </div>

      {/* 통계 카드 */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">전체 기록</p>
                <p className="text-3xl font-bold">{statistics.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">출근</p>
                <p className="text-3xl font-bold text-green-600">{statistics.checkIn}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">퇴근</p>
                <p className="text-3xl font-bold text-blue-600">{statistics.checkOut}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">생체인증</p>
                <p className="text-3xl font-bold text-purple-600">
                  {statistics.biometric}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">시작 날짜</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">종료 날짜</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">출근/퇴근</label>
              <Select value={filterCheckType} onValueChange={setFilterCheckType}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="IN">출근</SelectItem>
                  <SelectItem value="OUT">퇴근</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">인증 방법</label>
              <Select value={filterCheckMethod} onValueChange={setFilterCheckMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  <SelectItem value="BIOMETRIC">생체인증</SelectItem>
                  <SelectItem value="PIN">PIN</SelectItem>
                  <SelectItem value="QR">QR코드</SelectItem>
                  <SelectItem value="MANUAL">수동입력</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExportCSV} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                CSV 내보내기
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 기록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>출퇴근 기록 ({records.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">조회된 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">날짜/시간</th>
                    <th className="text-left py-3 px-4">직원명</th>
                    <th className="text-left py-3 px-4">부서</th>
                    <th className="text-left py-3 px-4">구분</th>
                    <th className="text-left py-3 px-4">인증 방법</th>
                    <th className="text-left py-3 px-4">비고</th>
                    <th className="text-left py-3 px-4">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-sm">
                              {new Date(record.checkTime).toLocaleDateString('ko-KR')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(record.checkTime).toLocaleTimeString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{record.staff.name}</div>
                      </td>
                      <td className="py-3 px-4">{record.staff.departmentName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.checkType === 'IN'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {record.checkType === 'IN' ? '출근' : '퇴근'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.checkMethod === 'BIOMETRIC'
                              ? 'bg-purple-100 text-purple-800'
                              : record.checkMethod === 'PIN'
                              ? 'bg-yellow-100 text-yellow-800'
                              : record.checkMethod === 'MANUAL'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-cyan-100 text-cyan-800'
                          }`}
                        >
                          {getMethodText(record.checkMethod)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {record.notes || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecord(record.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
