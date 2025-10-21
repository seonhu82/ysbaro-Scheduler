// API 응답 관련 타입 정의

/**
 * 성공 응답
 */
export interface SuccessResponse<T = unknown> {
  success: true
  data: T
  message?: string
}

/**
 * 에러 응답
 */
export interface ErrorResponse {
  success: false
  error: string
  details?: {
    field?: string
    message: string
  }[]
  statusCode?: number
}

/**
 * API 응답 (성공 또는 에러)
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * 검증 에러
 */
export interface ValidationError {
  field: string
  message: string
  value?: any
}

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

/**
 * 정렬 옵션
 */
export interface SortOption {
  field: string
  order: 'asc' | 'desc'
}

/**
 * 필터 옵션
 */
export interface FilterOption {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like'
  value: any
}
