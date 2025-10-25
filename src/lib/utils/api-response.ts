/**
 * API 응답 유틸리티
 * 일관된 응답 형식 제공
 */

import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

export interface ApiErrorResponse {
  success: false
  error: string
  details?: any
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

// 성공 응답
export function successResponse<T>(data: T, message?: string): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message
  })
}

// 에러 응답
export function errorResponse(
  error: string,
  status: number = 500,
  details?: any
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      details
    },
    { status }
  )
}

// 401 Unauthorized
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 401)
}

// 403 Forbidden
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 403)
}

// 400 Bad Request
export function badRequestResponse(message: string, details?: any): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 400, details)
}

// 404 Not Found
export function notFoundResponse(message: string = 'Resource not found'): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 404)
}

// 409 Conflict
export function conflictResponse(message: string, details?: any): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 409, details)
}

// 422 Unprocessable Entity (유효성 검증 실패)
export function validationErrorResponse(
  errors: string[] | Record<string, string>
): NextResponse<ApiErrorResponse> {
  return errorResponse(
    'Validation failed',
    422,
    { errors }
  )
}

// 500 Internal Server Error
export function internalErrorResponse(error?: any): NextResponse<ApiErrorResponse> {
  // 개발 환경에서만 에러 상세 정보 제공
  const isDev = process.env.NODE_ENV === 'development'

  return errorResponse(
    'Internal server error',
    500,
    isDev && error ? {
      message: error.message,
      stack: error.stack
    } : undefined
  )
}

// 에러 핸들러 래퍼
export async function withErrorHandling<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  try {
    return await handler()
  } catch (error: any) {
    console.error('API Error:', error)
    return internalErrorResponse(error)
  }
}

// 세션 검증 래퍼
export async function withAuth<T>(
  session: any,
  handler: () => Promise<NextResponse<T>>,
  allowedRoles?: string[]
): Promise<NextResponse<T | ApiErrorResponse>> {
  if (!session || !session.user) {
    return unauthorizedResponse()
  }

  if (!session.user.clinicId) {
    return badRequestResponse('No clinic found')
  }

  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return forbiddenResponse(`Requires one of: ${allowedRoles.join(', ')}`)
  }

  return handler()
}
