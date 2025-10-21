// 공통 타입 정의

/**
 * API 응답 타입
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 페이지네이션 파라미터
 */
export interface PaginationParams {
  page: number
  limit: number
}

/**
 * 페이지네이션 결과
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * 필터 파라미터
 */
export interface FilterParams {
  search?: string
  startDate?: Date
  endDate?: Date
  status?: string
  [key: string]: any
}

/**
 * 정렬 파라미터
 */
export interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

/**
 * 검증 에러
 */
export interface ValidationError {
  field: string
  message: string
}

/**
 * 에러 응답
 */
export interface ErrorResponse {
  success: false
  error: string
  details?: ValidationError[]
  statusCode?: number
}
