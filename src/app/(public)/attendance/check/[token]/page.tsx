/**
 * 모바일 출퇴근 체크 페이지 (외부 접근)
 * 경로: /attendance/check/[token]
 *
 * 기능:
 * - 직원 선택
 * - 출근/퇴근 버튼
 * - 디바이스 정보 자동 수집
 * - PIN 인증 (선택적)
 */

export default function MobileAttendanceCheckPage({
  params,
}: {
  params: { token: string };
}) {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">출퇴근 체크</h1>
        <p className="text-gray-600">토큰: {params.token}</p>
        <p className="text-gray-600 mt-4">구현 예정 - 모바일 전용</p>
      </div>
    </div>
  );
}
