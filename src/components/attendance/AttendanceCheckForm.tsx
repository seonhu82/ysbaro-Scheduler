/**
 * 출퇴근 체크 폼 컴포넌트 (모바일용)
 *
 * 기능:
 * - 직원 선택
 * - 출근/퇴근 선택
 * - 디바이스 정보 자동 수집
 * - 제출 및 결과 표시
 */

'use client';

import { useState } from 'react';

export function AttendanceCheckForm({ token }: { token: string }) {
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [checkType, setCheckType] = useState<'IN' | 'OUT'>('IN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: 구현 예정
  // 1. 직원 목록 불러오기
  // 2. 디바이스 정보 수집 (fingerprint)
  // 3. API 호출
  // 4. 성공/실패 메시지

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 구현
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">직원 선택</label>
        <select
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          className="w-full border rounded-md p-2"
          required
        >
          <option value="">선택하세요</option>
          {/* TODO: 직원 목록 */}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">구분</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setCheckType('IN')}
            className={`p-4 rounded-lg border-2 ${
              checkType === 'IN'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            출근
          </button>
          <button
            type="button"
            onClick={() => setCheckType('OUT')}
            className={`p-4 rounded-lg border-2 ${
              checkType === 'OUT'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
            }`}
          >
            퇴근
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedStaff}
        className="w-full bg-blue-500 text-white p-4 rounded-lg font-medium disabled:opacity-50"
      >
        {isSubmitting ? '처리 중...' : checkType === 'IN' ? '출근 체크' : '퇴근 체크'}
      </button>
    </form>
  );
}
