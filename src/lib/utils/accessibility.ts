/**
 * 접근성 유틸리티
 *
 * WCAG 2.1 AA 준수를 위한 헬퍼 함수들
 */

/**
 * 스크린 리더 전용 텍스트를 위한 클래스
 */
export const srOnly = 'sr-only absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0'

/**
 * 키보드 포커스 스타일
 */
export const focusRing = 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

/**
 * 터치 타겟 최소 크기 (44px x 44px)
 */
export const touchTarget = 'min-h-[44px] min-w-[44px]'

/**
 * 키보드 이벤트 핸들러 생성
 * Enter와 Space 키로 클릭 동작을 트리거
 */
export function createKeyboardHandler(onClick: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }
}

/**
 * Escape 키 핸들러
 */
export function createEscapeHandler(onEscape: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onEscape()
    }
  }
}

/**
 * 포커스 트랩 (모달, 다이얼로그용)
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  React.useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // 초기 포커스
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    return () => container.removeEventListener('keydown', handleTabKey)
  }, [containerRef, isActive])
}

/**
 * ARIA 라이브 리전 알림
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = srOnly
  announcement.textContent = message

  document.body.appendChild(announcement)

  // 1초 후 제거
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * 상태에 따른 ARIA 속성 생성
 */
export function getAriaProps(state: {
  label?: string
  description?: string
  required?: boolean
  invalid?: boolean
  disabled?: boolean
  expanded?: boolean
  selected?: boolean
  checked?: boolean
}) {
  const props: Record<string, any> = {}

  if (state.label) props['aria-label'] = state.label
  if (state.description) props['aria-describedby'] = state.description
  if (state.required) props['aria-required'] = true
  if (state.invalid) props['aria-invalid'] = true
  if (state.disabled) props['aria-disabled'] = true
  if (state.expanded !== undefined) props['aria-expanded'] = state.expanded
  if (state.selected !== undefined) props['aria-selected'] = state.selected
  if (state.checked !== undefined) props['aria-checked'] = state.checked

  return props
}

/**
 * 색상 대비 검사 (WCAG AA: 4.5:1, AAA: 7:1)
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.replace('#', ''), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff

    const [rs, gs, bs] = [r, g, b].map(c => {
      const sRGB = c / 255
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const lum1 = getLuminance(hex1)
  const lum2 = getLuminance(hex2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 상태별 색상 + 아이콘 + 텍스트 조합
 */
export const statusIndicators = {
  success: {
    color: 'text-green-700 bg-green-50 border-green-200',
    icon: '✓',
    ariaLabel: '성공'
  },
  error: {
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: '✕',
    ariaLabel: '오류'
  },
  warning: {
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    icon: '⚠',
    ariaLabel: '경고'
  },
  info: {
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: 'ℹ',
    ariaLabel: '정보'
  },
  pending: {
    color: 'text-gray-700 bg-gray-50 border-gray-200',
    icon: '○',
    ariaLabel: '대기 중'
  }
} as const

/**
 * 로딩 상태 스켈레톤 클래스
 */
export const skeletonClasses = 'animate-pulse bg-gray-200 rounded'

/**
 * React import for hooks
 */
import React from 'react'
