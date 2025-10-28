/**
 * 접근성이 강화된 폼 필드 컴포넌트
 *
 * WCAG 2.1 AA 준수:
 * - 명확한 레이블 연결
 * - 인라인 에러 메시지
 * - ARIA 속성 자동 설정
 * - 터치 타겟 44px 이상
 * - 키보드 네비게이션 지원
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { focusRing, touchTarget } from "@/lib/utils/accessibility"

export interface FormFieldProps {
  // 필수 속성
  id: string
  label: string

  // 입력 요소
  children: React.ReactNode

  // 상태
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean

  // 레이아웃
  layout?: "vertical" | "horizontal"
  className?: string
}

/**
 * 폼 필드 컨테이너
 */
export function FormField({
  id,
  label,
  children,
  error,
  helperText,
  required = false,
  disabled = false,
  layout = "vertical",
  className
}: FormFieldProps) {
  const errorId = `${id}-error`
  const helperId = `${id}-helper`

  // ARIA describedby 동적 생성
  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null
  ].filter(Boolean).join(" ") || undefined

  return (
    <div
      className={cn(
        "form-field",
        layout === "horizontal" ? "flex items-start gap-4" : "flex flex-col gap-2",
        className
      )}
    >
      {/* 레이블 */}
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-medium text-gray-700",
          layout === "horizontal" ? "min-w-[120px] pt-2" : "",
          disabled && "text-gray-400 cursor-not-allowed",
          "select-none"
        )}
      >
        {label}
        {required && (
          <span
            className="text-red-500 ml-1"
            aria-label="필수 입력"
          >
            *
          </span>
        )}
      </label>

      {/* 입력 필드 + 메시지 */}
      <div className="flex-1 space-y-1">
        {/* 입력 요소에 ARIA 속성 주입 */}
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, {
              id,
              "aria-describedby": describedBy,
              "aria-invalid": error ? true : undefined,
              "aria-required": required ? true : undefined,
              disabled
            })
          }
          return child
        })}

        {/* 에러 메시지 */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 text-sm text-red-600"
          >
            <span aria-hidden="true" className="text-base">✕</span>
            <span>{error}</span>
          </div>
        )}

        {/* 도움말 텍스트 */}
        {helperText && !error && (
          <div
            id={helperId}
            className="text-sm text-gray-500"
          >
            {helperText}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 텍스트 입력
 */
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // 기본 스타일
          "w-full px-3 py-2 rounded-md border bg-white",
          "text-sm text-gray-900 placeholder:text-gray-400",

          // 터치 타겟
          touchTarget,

          // 상태별 스타일
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",

          // 포커스
          focusRing,

          // 비활성화
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",

          className
        )}
        {...props}
      />
    )
  }
)
TextInput.displayName = "TextInput"

/**
 * 텍스트 영역
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // 기본 스타일
          "w-full px-3 py-2 rounded-md border bg-white",
          "text-sm text-gray-900 placeholder:text-gray-400",
          "resize-y",

          // 최소 높이
          "min-h-[100px]",

          // 상태별 스타일
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",

          // 포커스
          focusRing,

          // 비활성화
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",

          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

/**
 * 셀렉트 박스
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          // 기본 스타일
          "w-full px-3 py-2 rounded-md border bg-white",
          "text-sm text-gray-900",

          // 터치 타겟
          touchTarget,

          // 상태별 스타일
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:border-blue-500 focus:ring-blue-500",

          // 포커스
          focusRing,

          // 비활성화
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",

          className
        )}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

/**
 * 체크박스
 */
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: boolean
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          ref={ref}
          id={id}
          className={cn(
            // 기본 스타일
            "rounded border-gray-300",
            "text-blue-600 focus:ring-blue-500",

            // 크기 (터치 타겟)
            "h-5 w-5",

            // 포커스
            focusRing,

            // 에러
            error && "border-red-300",

            // 비활성화
            "disabled:cursor-not-allowed disabled:opacity-50",

            className
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "text-sm text-gray-700 select-none cursor-pointer",
            "disabled:text-gray-400 disabled:cursor-not-allowed"
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

/**
 * 라디오 버튼
 */
export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: boolean
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <input
          type="radio"
          ref={ref}
          id={id}
          className={cn(
            // 기본 스타일
            "border-gray-300",
            "text-blue-600 focus:ring-blue-500",

            // 크기 (터치 타겟)
            "h-5 w-5",

            // 포커스
            focusRing,

            // 에러
            error && "border-red-300",

            // 비활성화
            "disabled:cursor-not-allowed disabled:opacity-50",

            className
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            "text-sm text-gray-700 select-none cursor-pointer",
            "disabled:text-gray-400 disabled:cursor-not-allowed"
          )}
        >
          {label}
        </label>
      </div>
    )
  }
)
Radio.displayName = "Radio"

/**
 * 라디오 그룹
 */
export interface RadioGroupProps {
  id: string
  label: string
  options: Array<{ value: string; label: string }>
  value?: string
  onChange?: (value: string) => void
  error?: string
  required?: boolean
  disabled?: boolean
}

export function RadioGroup({
  id,
  label,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false
}: RadioGroupProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="필수 선택">
            *
          </span>
        )}
      </legend>

      <div
        role="radiogroup"
        aria-labelledby={`${id}-legend`}
        aria-required={required}
        className="space-y-2"
      >
        {options.map((option, index) => (
          <Radio
            key={option.value}
            id={`${id}-${index}`}
            name={id}
            label={option.label}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange?.(e.target.value)}
            error={!!error}
            disabled={disabled}
          />
        ))}
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 text-sm text-red-600 mt-1"
        >
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </div>
      )}
    </fieldset>
  )
}

/**
 * 파일 입력
 */
export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: boolean
  acceptLabel?: string
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, error, acceptLabel, ...props }, ref) => {
    return (
      <div className="space-y-1">
        <input
          type="file"
          ref={ref}
          className={cn(
            // 기본 스타일
            "block w-full text-sm text-gray-900",
            "file:mr-4 file:py-2 file:px-4",
            "file:rounded-md file:border-0",
            "file:text-sm file:font-medium",
            "file:bg-blue-50 file:text-blue-700",
            "hover:file:bg-blue-100",

            // 터치 타겟
            "file:min-h-[44px]",

            // 포커스
            focusRing,

            // 에러
            error && "text-red-600 file:bg-red-50 file:text-red-700",

            // 비활성화
            "disabled:cursor-not-allowed disabled:opacity-50",

            className
          )}
          {...props}
        />
        {acceptLabel && (
          <p className="text-xs text-gray-500">{acceptLabel}</p>
        )}
      </div>
    )
  }
)
FileInput.displayName = "FileInput"
