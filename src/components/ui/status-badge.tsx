/**
 * 상태 배지 컴포넌트
 *
 * 색상 + 아이콘 + 텍스트 조합으로 정보 전달 (WCAG 준수)
 * - 색맹 사용자도 아이콘으로 구분 가능
 * - 스크린 리더 사용자도 명확한 레이블 제공
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { statusIndicators } from "@/lib/utils/accessibility"

export type StatusType = keyof typeof statusIndicators

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType
  children?: React.ReactNode
  showIcon?: boolean
  size?: "sm" | "md" | "lg"
}

/**
 * 기본 상태 배지
 */
export function StatusBadge({
  status,
  children,
  showIcon = true,
  size = "md",
  className,
  ...props
}: StatusBadgeProps) {
  const indicator = statusIndicators[status]

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5"
  }

  return (
    <span
      role="status"
      aria-label={`${indicator.ariaLabel}: ${children || ''}`}
      className={cn(
        // 기본 스타일
        "inline-flex items-center gap-1.5 rounded-full font-medium border",

        // 크기
        sizeClasses[size],

        // 상태별 색상
        indicator.color,

        className
      )}
      {...props}
    >
      {showIcon && (
        <span aria-hidden="true" className="text-base leading-none">
          {indicator.icon}
        </span>
      )}
      <span>{children}</span>
    </span>
  )
}

/**
 * 연차 신청 상태 배지
 */
export type LeaveStatus = "PENDING" | "CONFIRMED" | "ON_HOLD" | "REJECTED"

const leaveStatusMap: Record<LeaveStatus, { status: StatusType; label: string }> = {
  PENDING: { status: "pending", label: "검토 중" },
  CONFIRMED: { status: "success", label: "승인됨" },
  ON_HOLD: { status: "warning", label: "보류" },
  REJECTED: { status: "error", label: "반려" }
}

export function LeaveStatusBadge({
  status,
  size = "md",
  className
}: {
  status: LeaveStatus
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = leaveStatusMap[status]
  return (
    <StatusBadge status={mapping.status} size={size} className={className}>
      {mapping.label}
    </StatusBadge>
  )
}

/**
 * 근무 형태 배지
 */
export type ShiftType = "MORNING" | "AFTERNOON" | "FULL" | "OFF" | "LEAVE"

const shiftTypeMap: Record<ShiftType, { status: StatusType; label: string; icon: string }> = {
  MORNING: { status: "info", label: "오전", icon: "🌅" },
  AFTERNOON: { status: "info", label: "오후", icon: "🌆" },
  FULL: { status: "success", label: "풀타임", icon: "🌞" },
  OFF: { status: "pending", label: "오프", icon: "🌙" },
  LEAVE: { status: "warning", label: "연차", icon: "🏖" }
}

export function ShiftBadge({
  shift,
  size = "md",
  className
}: {
  shift: ShiftType
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = shiftTypeMap[shift]

  return (
    <span
      role="status"
      aria-label={`근무: ${mapping.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-3 py-1",
        size === "lg" && "text-base px-4 py-1.5",
        statusIndicators[mapping.status].color,
        className
      )}
    >
      <span aria-hidden="true">{mapping.icon}</span>
      <span>{mapping.label}</span>
    </span>
  )
}

/**
 * 연차 유형 배지
 */
export type LeaveType = "ANNUAL" | "SICK" | "HALF_DAY" | "SPECIAL"

const leaveTypeMap: Record<LeaveType, { label: string; icon: string; color: string }> = {
  ANNUAL: {
    label: "연차",
    icon: "📅",
    color: "text-blue-700 bg-blue-50 border-blue-200"
  },
  SICK: {
    label: "병가",
    icon: "🏥",
    color: "text-purple-700 bg-purple-50 border-purple-200"
  },
  HALF_DAY: {
    label: "반차",
    icon: "🕐",
    color: "text-cyan-700 bg-cyan-50 border-cyan-200"
  },
  SPECIAL: {
    label: "특별휴가",
    icon: "⭐",
    color: "text-amber-700 bg-amber-50 border-amber-200"
  }
}

export function LeaveTypeBadge({
  type,
  size = "md",
  className
}: {
  type: LeaveType
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = leaveTypeMap[type]

  return (
    <span
      role="status"
      aria-label={`유형: ${mapping.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-3 py-1",
        size === "lg" && "text-base px-4 py-1.5",
        mapping.color,
        className
      )}
    >
      <span aria-hidden="true">{mapping.icon}</span>
      <span>{mapping.label}</span>
    </span>
  )
}

/**
 * 계정 상태 배지
 */
export type AccountStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED"

const accountStatusMap: Record<AccountStatus, { status: StatusType; label: string }> = {
  PENDING: { status: "pending", label: "대기 중" },
  APPROVED: { status: "success", label: "승인됨" },
  SUSPENDED: { status: "warning", label: "정지됨" },
  REJECTED: { status: "error", label: "거부됨" }
}

export function AccountStatusBadge({
  status,
  size = "md",
  className
}: {
  status: AccountStatus
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = accountStatusMap[status]
  return (
    <StatusBadge status={mapping.status} size={size} className={className}>
      {mapping.label}
    </StatusBadge>
  )
}

/**
 * 할당 모드 배지
 */
export type AssignMode = "AUTO" | "MANUAL" | "HYBRID" | "FLEXIBLE"

const assignModeMap: Record<AssignMode, { label: string; icon: string; color: string }> = {
  AUTO: {
    label: "자동 배치",
    icon: "🤖",
    color: "text-green-700 bg-green-50 border-green-200"
  },
  MANUAL: {
    label: "수동 배치",
    icon: "✋",
    color: "text-gray-700 bg-gray-50 border-gray-200"
  },
  HYBRID: {
    label: "하이브리드",
    icon: "⚙️",
    color: "text-blue-700 bg-blue-50 border-blue-200"
  },
  FLEXIBLE: {
    label: "유연 배치",
    icon: "🌊",
    color: "text-purple-700 bg-purple-50 border-purple-200"
  }
}

export function AssignModeBadge({
  mode,
  size = "md",
  className
}: {
  mode: AssignMode
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = assignModeMap[mode]

  return (
    <span
      role="status"
      aria-label={`배치 모드: ${mapping.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-3 py-1",
        size === "lg" && "text-base px-4 py-1.5",
        mapping.color,
        className
      )}
    >
      <span aria-hidden="true">{mapping.icon}</span>
      <span>{mapping.label}</span>
    </span>
  )
}

/**
 * 출퇴근 상태 배지
 */
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EARLY_LEAVE" | "SUSPICIOUS"

const attendanceStatusMap: Record<AttendanceStatus, { status: StatusType; label: string }> = {
  PRESENT: { status: "success", label: "정상 출근" },
  ABSENT: { status: "error", label: "결근" },
  LATE: { status: "warning", label: "지각" },
  EARLY_LEAVE: { status: "warning", label: "조퇴" },
  SUSPICIOUS: { status: "error", label: "의심스러운 패턴" }
}

export function AttendanceStatusBadge({
  status,
  size = "md",
  className
}: {
  status: AttendanceStatus
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const mapping = attendanceStatusMap[status]
  return (
    <StatusBadge status={mapping.status} size={size} className={className}>
      {mapping.label}
    </StatusBadge>
  )
}
