/**
 * 출퇴근 통계 컴포넌트
 *
 * 기능:
 * - 월별 출퇴근 통계
 * - 지각/조퇴 통계
 * - 직원별 통계
 * - 차트 표시
 */

'use client';

export function AttendanceStatistics() {
  // TODO: 구현 예정
  // Chart.js 또는 Recharts 사용

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-600">총 출근</h4>
        <p className="text-3xl font-bold mt-2">0</p>
        <p className="text-xs text-gray-500 mt-1">이번 달</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-600">지각</h4>
        <p className="text-3xl font-bold mt-2 text-red-500">0</p>
        <p className="text-xs text-gray-500 mt-1">이번 달</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-600">조퇴</h4>
        <p className="text-3xl font-bold mt-2 text-orange-500">0</p>
        <p className="text-xs text-gray-500 mt-1">이번 달</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-600">정상 출근율</h4>
        <p className="text-3xl font-bold mt-2 text-green-500">0%</p>
        <p className="text-xs text-gray-500 mt-1">이번 달</p>
      </div>
    </div>
  );
}
