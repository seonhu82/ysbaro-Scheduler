/**
 * 출퇴근 이력 컴포넌트
 *
 * 기능:
 * - 출퇴근 기록 테이블
 * - 날짜 필터
 * - 직원 필터
 * - 지각/조퇴 표시
 */

'use client';

export function AttendanceHistory() {
  // TODO: 구현 예정

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">출퇴근 이력</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">날짜</th>
              <th className="text-left p-2">직원</th>
              <th className="text-left p-2">출근</th>
              <th className="text-left p-2">퇴근</th>
              <th className="text-left p-2">상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2" colSpan={5}>
                <p className="text-gray-500 text-center">구현 예정</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
