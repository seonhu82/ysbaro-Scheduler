/**
 * 데이터 유효성 검증 유틸리티
 */

// 이메일 형식 검증
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// 전화번호 형식 검증 (한국 형식)
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

// PIN 형식 검증 (4-6자리 숫자)
export function isValidPin(pin: string): boolean {
  const pinRegex = /^[0-9]{4,6}$/
  return pinRegex.test(pin)
}

// 날짜 형식 검증 (YYYY-MM-DD)
export function isValidDate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) return false

  const date = new Date(dateStr)
  return date instanceof Date && !isNaN(date.getTime())
}

// 날짜 범위 검증
export function isDateInRange(date: Date, minDate?: Date, maxDate?: Date): boolean {
  if (minDate && date < minDate) return false
  if (maxDate && date > maxDate) return false
  return true
}

// 이름 검증 (2-50자, 한글/영문/공백)
export function isValidName(name: string): boolean {
  if (!name || name.length < 2 || name.length > 50) return false
  const nameRegex = /^[가-힣a-zA-Z\s]+$/
  return nameRegex.test(name)
}

// 비밀번호 강도 검증 (최소 8자, 영문+숫자+특수문자)
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false

  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

  return hasLetter && hasNumber && hasSpecial
}

// 숫자 범위 검증
export function isNumberInRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max
}

// 필수 필드 검증
export function validateRequiredFields<T extends object>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  for (const field of requiredFields) {
    const value = data[field]
    if (value === undefined || value === null || value === '') {
      missingFields.push(String(field))
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields
  }
}

// 객체 구조 검증
interface SchemaRule {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  required?: boolean
  validator?: (value: any) => boolean
}

export function validateSchema<T>(
  data: any,
  schema: {
    [K in keyof T]: SchemaRule
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key]
    const schemaRules = rules as SchemaRule

    // 필수 필드 체크
    if (schemaRules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`)
      continue
    }

    // 값이 없으면 스킵 (선택 필드)
    if (value === undefined || value === null) continue

    // 타입 체크
    switch (schemaRules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${key} must be a string`)
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${key} must be a number`)
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${key} must be a boolean`)
        }
        break
      case 'date':
        if (!(value instanceof Date) && !isValidDate(String(value))) {
          errors.push(`${key} must be a valid date`)
        }
        break
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`)
        }
        break
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${key} must be an object`)
        }
        break
    }

    // 커스텀 검증
    if (schemaRules.validator && !schemaRules.validator(value)) {
      errors.push(`${key} validation failed`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// 세션 검증
export function validateSession(session: any): { valid: boolean; error?: string } {
  if (!session) {
    return { valid: false, error: 'Unauthorized: No session' }
  }

  if (!session.user) {
    return { valid: false, error: 'Unauthorized: No user in session' }
  }

  if (!session.user.clinicId) {
    return { valid: false, error: 'Unauthorized: No clinic found' }
  }

  return { valid: true }
}

// 권한 검증
export function validateRole(
  userRole: string,
  allowedRoles: string[]
): { valid: boolean; error?: string } {
  if (!allowedRoles.includes(userRole)) {
    return {
      valid: false,
      error: `Forbidden: Requires one of [${allowedRoles.join(', ')}]`
    }
  }

  return { valid: true }
}

// 날짜 문자열을 Date 객체로 안전하게 변환
export function safeParseDate(dateStr: string): Date | null {
  if (!isValidDate(dateStr)) return null

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return null

  return date
}

// 숫자 문자열을 숫자로 안전하게 변환
export function safeParseNumber(numStr: string): number | null {
  const num = Number(numStr)
  if (isNaN(num)) return null
  return num
}
