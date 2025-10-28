/**
 * 출퇴근 관리 서비스
 *
 * 주요 기능:
 * 1. 출퇴근 체크 처리
 * 2. 중복 체크 방지
 * 3. 디바이스 정보 관리
 * 4. 의심 패턴 감지
 */

import { prisma } from '@/lib/prisma';
import { CheckType } from '@prisma/client';

export interface CheckInData {
  staffId: string;
  token: string;
  checkType: CheckType;
  deviceInfo: DeviceFingerprint;
  location?: LocationInfo;
}

export interface DeviceFingerprint {
  userAgent: string;
  platform?: string;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
}

export interface LocationInfo {
  wifiSSID?: string;
  ipAddress?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

/**
 * 출퇴근 체크 처리
 */
export async function processAttendanceCheck(
  data: CheckInData
): Promise<{ success: boolean; message: string; recordId?: string; warning?: string }> {
  const { staffId, token, checkType, deviceInfo, location } = data;

  // 1. 직원 정보 조회
  const staff = await prisma.staff.findUnique({
    where: { id: staffId }
  });

  if (!staff) {
    return {
      success: false,
      message: '존재하지 않는 직원입니다'
    };
  }

  // 2. 중복 체크 확인
  const now = new Date();
  const isDuplicate = await isDuplicateCheck(staffId, checkType, now);

  if (isDuplicate) {
    return {
      success: false,
      message: `오늘 이미 ${checkType === 'IN' ? '출근' : '퇴근'} 처리되었습니다`
    };
  }

  // 🆕 3. 스케줄 연동: DailyAssignment 확인
  const todayDate = new Date(now.toDateString())
  const scheduleCheck = await checkScheduleAlignment(staffId, todayDate, checkType)

  // 3-1. 디바이스 핑거프린트 생성
  const fingerprint = generateDeviceFingerprint(deviceInfo);

  // 4. 출퇴근 기록 저장 (스케줄 정보 포함)
  const record = await prisma.attendanceRecord.create({
    data: {
      clinicId: staff.clinicId,
      staffId,
      checkType,
      checkTime: now,
      date: todayDate,
      tokenUsed: token,
      deviceFingerprint: fingerprint,
      userAgent: deviceInfo.userAgent,
      ipAddress: location?.ipAddress,
      wifiSSID: location?.wifiSSID,
      gpsLatitude: location?.gpsLatitude,
      gpsLongitude: location?.gpsLongitude,
      // 🆕 스케줄 정보 저장
      staffAssignmentId: scheduleCheck.assignmentId,
      isScheduled: scheduleCheck.isScheduled,
      scheduleNote: scheduleCheck.note
    }
  });

  // 5. 의심 패턴 감지 (스케줄 불일치 포함)
  const suspiciousCheck = await detectSuspiciousPattern(
    staffId,
    now,
    fingerprint,
    scheduleCheck.isScheduled
  );

  if (suspiciousCheck.isSuspicious) {
    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        isSuspicious: true,
        suspiciousReason: suspiciousCheck.patterns.join(', ')
      }
    });
  }

  // 🆕 6. 스케줄 불일치 경고 메시지 및 StaffAssignment 업데이트
  let warningMessage: string | undefined
  if (!scheduleCheck.isScheduled && checkType === 'IN') {
    warningMessage = '⚠️ 오늘 근무 스케줄에 없는 출근입니다.'
  } else if (scheduleCheck.isScheduled && scheduleCheck.assignmentId) {
    // StaffAssignment에 실제 출퇴근 시간 기록
    await prisma.staffAssignment.update({
      where: { id: scheduleCheck.assignmentId },
      data: {
        actualCheckInTime: checkType === 'IN' ? now : undefined,
        actualCheckOutTime: checkType === 'OUT' ? now : undefined
      }
    })
  }

  return {
    success: true,
    message: `${checkType === 'IN' ? '출근' : '퇴근'}이 기록되었습니다`,
    recordId: record.id,
    warning: warningMessage
  };
}

/**
 * 디바이스 핑거프린트 생성
 */
export function generateDeviceFingerprint(
  deviceInfo: DeviceFingerprint
): string {
  const crypto = require('crypto');

  const components = [
    deviceInfo.userAgent,
    deviceInfo.platform || '',
    deviceInfo.screenWidth?.toString() || '',
    deviceInfo.screenHeight?.toString() || '',
    deviceInfo.timezone || ''
  ];

  const combined = components.join('|');
  return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32);
}

/**
 * 중복 체크 확인
 */
export async function isDuplicateCheck(
  staffId: string,
  checkType: CheckType,
  date: Date
): Promise<boolean> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingCheck = await prisma.attendanceRecord.findFirst({
    where: {
      staffId,
      checkType,
      checkTime: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });

  return !!existingCheck;
}

/**
 * 🆕 스케줄 일치 확인
 * - StaffAssignment에 해당 직원의 오늘 근무가 있는지 확인
 */
export async function checkScheduleAlignment(
  staffId: string,
  date: Date,
  checkType: CheckType
): Promise<{
  isScheduled: boolean
  assignmentId?: string
  note?: string
}> {
  // StaffAssignment에서 해당 날짜의 배치 조회
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      staffId,
      date
    }
  })

  if (!assignment) {
    return {
      isScheduled: false,
      note: '스케줄에 없는 근무'
    }
  }

  // OFF 시프트 확인
  if (assignment.shiftType === 'OFF') {
    return {
      isScheduled: false,
      assignmentId: assignment.id,
      note: '오프 예정일에 출근'
    }
  }

  return {
    isScheduled: true,
    assignmentId: assignment.id
  }
}

/**
 * 의심 패턴 감지 (스케줄 불일치 포함)
 */
export async function detectSuspiciousPattern(
  staffId: string,
  checkTime: Date,
  deviceFingerprint: string,
  isScheduled: boolean = true
): Promise<{
  isSuspicious: boolean;
  patterns: string[];
}> {
  const patterns: string[] = [];

  // 🆕 0. 스케줄 불일치 감지
  if (!isScheduled) {
    patterns.push('스케줄에 없는 근무')
  }

  // 1. 최근 30일간의 기록 조회
  const thirtyDaysAgo = new Date(checkTime);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentRecords = await prisma.attendanceRecord.findMany({
    where: {
      staffId,
      checkTime: {
        gte: thirtyDaysAgo
      }
    },
    orderBy: {
      checkTime: 'desc'
    }
  });

  // 2. 디바이스 변경 감지 (최근 3개 기록이 모두 동일한 디바이스인데 갑자기 변경)
  if (recentRecords.length >= 3) {
    const recentDevices = recentRecords.slice(0, 3).map(r => r.deviceFingerprint);
    const isConsistent = recentDevices.every(d => d === recentDevices[0]);

    if (isConsistent && recentDevices[0] !== deviceFingerprint) {
      patterns.push('디바이스 변경 감지');
    }
  }

  // 3. 비정상 시간 감지 (새벽 2시~5시 사이 체크)
  const hour = checkTime.getHours();
  if (hour >= 2 && hour < 5) {
    patterns.push('비정상 시간대 체크');
  }

  // 4. 연속 체크 감지 (10분 내에 다른 직원과 동일한 토큰 사용)
  const tenMinutesAgo = new Date(checkTime);
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  const recentSameTokenChecks = await prisma.attendanceRecord.findMany({
    where: {
      staffId: {
        not: staffId
      },
      checkTime: {
        gte: tenMinutesAgo,
        lte: checkTime
      },
      tokenUsed: recentRecords[0]?.tokenUsed
    }
  });

  if (recentSameTokenChecks.length > 0) {
    patterns.push('동일 토큰 연속 사용 감지');
  }

  return {
    isSuspicious: patterns.length > 0,
    patterns
  };
}
