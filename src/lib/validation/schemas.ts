/**
 * Zod 검증 스키마 모음
 * - API 입력 검증용
 * - 타입 안전성 보장
 */

import { z } from 'zod'

// ============================================
// 공통 스키마
// ============================================

export const cuidSchema = z.string().cuid()
export const emailSchema = z.string().email('유효한 이메일 주소를 입력해주세요')
export const dateSchema = z.coerce.date()
export const yearSchema = z.number().int().min(2020).max(2100)
export const monthSchema = z.number().int().min(1).max(12)

// ============================================
// 사용자 인증/등록
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
  rememberMe: z.boolean().optional()
})

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
    .regex(/[A-Z]/, '비밀번호에 대문자가 최소 1개 포함되어야 합니다')
    .regex(/[a-z]/, '비밀번호에 소문자가 최소 1개 포함되어야 합니다')
    .regex(/[0-9]/, '비밀번호에 숫자가 최소 1개 포함되어야 합니다'),
  name: z.string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(50, '이름은 최대 50자까지 입력 가능합니다')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문, 공백만 입력 가능합니다'),
  clinicName: z.string().min(2).max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional()
})

// ============================================
// 주간 배치
// ============================================

export const weeklyAssignSchema = z.object({
  weekInfoId: cuidSchema
})

export const monthlyAssignSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  clinicId: cuidSchema.optional()
})

// ============================================
// 연차 신청
// ============================================

export const leaveApplicationSchema = z.object({
  date: dateSchema,
  type: z.enum(['ANNUAL', 'OFF']),
  pin: z.string()
    .length(6, 'PIN은 6자리여야 합니다')
    .regex(/^\d{6}$/, 'PIN은 숫자만 입력 가능합니다'),
  otherSelectedDates: z.array(dateSchema).optional() // 형평성 검증용 다른 선택 날짜들
})

export const leaveStatusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'ON_HOLD'])
})

// ============================================
// 부서/직원 관리
// ============================================

export const departmentReorderSchema = z.object({
  departments: z.array(
    z.object({
      id: cuidSchema,
      order: z.number().int().min(0).max(1000)
    })
  ).min(1, '최소 1개 이상의 부서가 필요합니다').max(100, '최대 100개까지 가능합니다')
})

export const staffCreateSchema = z.object({
  name: z.string()
    .min(2, '이름은 최소 2자 이상이어야 합니다')
    .max(50, '이름은 최대 50자까지 입력 가능합니다')
    .regex(/^[가-힣a-zA-Z\s]+$/, '이름은 한글, 영문, 공백만 입력 가능합니다'),
  email: emailSchema.optional(),
  departmentId: cuidSchema.optional(),
  categoryName: z.string().min(1).max(50).optional(),
  rank: z.enum(['HYGIENIST', 'ASSISTANT', 'COORDINATOR', 'NURSE', 'OTHER']).optional(),
  workType: z.enum(['WEEK_4', 'WEEK_5']),
  pin: z.string()
    .length(6, 'PIN은 6자리여야 합니다')
    .regex(/^\d{6}$/, 'PIN은 숫자만 입력 가능합니다'),
  isActive: z.boolean().default(true),
  flexibleForCategories: z.array(z.string()).optional(),
  flexibilityPriority: z.number().int().min(0).max(100).default(0)
})

export const staffUpdateSchema = staffCreateSchema.partial().extend({
  id: cuidSchema
})

// ============================================
// 출퇴근 관리
// ============================================

export const attendanceCheckSchema = z.object({
  token: z.string().min(10),
  deviceFingerprint: z.string().optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }).optional()
})

// ============================================
// 통계 조회
// ============================================

export const statisticsQuerySchema = z.object({
  year: yearSchema,
  month: monthSchema,
  departmentId: cuidSchema.optional(),
  staffId: cuidSchema.optional()
})

// ============================================
// 설정 관리
// ============================================

export const fairnessSettingsSchema = z.object({
  enableNightShiftFairness: z.boolean(),
  enableWeekendFairness: z.boolean(),
  enableHolidayFairness: z.boolean(),
  enableHolidayAdjacentFairness: z.boolean(),
  nightShiftThreshold: z.number().min(0).max(50),
  weekendThreshold: z.number().min(0).max(50),
  holidayThreshold: z.number().min(0).max(50)
})

export const categoryRatioSchema = z.object({
  ratios: z.record(
    z.string(),
    z.number().min(0).max(100)
  )
}).refine(
  (data) => {
    const total = Object.values(data.ratios).reduce((sum, val) => sum + val, 0)
    return Math.abs(total - 100) < 0.01 // 부동소수점 오차 허용
  },
  { message: '비율의 합계는 100%여야 합니다' }
)

// ============================================
// 헬퍼 함수
// ============================================

/**
 * Zod 검증 실행 및 에러 포맷팅
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string[]> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  // Zod 에러를 필드별로 그룹화
  const errors: Record<string, string[]> = {}
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.')
    if (!errors[path]) {
      errors[path] = []
    }
    errors[path].push(issue.message)
  })

  return { success: false, errors }
}

/**
 * 검증 실패 시 표준 에러 응답 생성
 */
export function validationErrorResponse(errors: Record<string, string[]>) {
  return {
    success: false,
    error: '입력 데이터가 올바르지 않습니다',
    validationErrors: errors
  }
}
