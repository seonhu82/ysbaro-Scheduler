/**
 * accessibility 유틸리티 단위 테스트
 *
 * WCAG 접근성 헬퍼 함수 테스트
 *
 * @jest-environment jsdom
 */

import {
  createKeyboardHandler,
  createEscapeHandler,
  getAriaProps,
  getContrastRatio,
  announceToScreenReader
} from '../accessibility'

describe('accessibility utilities', () => {
  describe('createKeyboardHandler', () => {
    it('Enter 키 눌렀을 때 onClick 호출', () => {
      const onClick = jest.fn()
      const handler = createKeyboardHandler(onClick)

      const event = {
        key: 'Enter',
        preventDefault: jest.fn()
      } as any

      handler(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(onClick).toHaveBeenCalled()
    })

    it('Space 키 눌렀을 때 onClick 호출', () => {
      const onClick = jest.fn()
      const handler = createKeyboardHandler(onClick)

      const event = {
        key: ' ',
        preventDefault: jest.fn()
      } as any

      handler(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(onClick).toHaveBeenCalled()
    })

    it('다른 키는 무시', () => {
      const onClick = jest.fn()
      const handler = createKeyboardHandler(onClick)

      const event = {
        key: 'a',
        preventDefault: jest.fn()
      } as any

      handler(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('createEscapeHandler', () => {
    it('Escape 키 눌렀을 때 onEscape 호출', () => {
      const onEscape = jest.fn()
      const handler = createEscapeHandler(onEscape)

      const event = {
        key: 'Escape',
        preventDefault: jest.fn()
      } as any

      handler(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(onEscape).toHaveBeenCalled()
    })

    it('다른 키는 무시', () => {
      const onEscape = jest.fn()
      const handler = createEscapeHandler(onEscape)

      const event = {
        key: 'Enter',
        preventDefault: jest.fn()
      } as any

      handler(event)

      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(onEscape).not.toHaveBeenCalled()
    })
  })

  describe('getAriaProps', () => {
    it('모든 속성 올바르게 생성', () => {
      const state = {
        label: '테스트 레이블',
        description: 'test-desc',
        required: true,
        invalid: true,
        disabled: true, // false는 제외되므로 true로 변경
        expanded: true,
        selected: false,
        checked: true
      }

      const props = getAriaProps(state)

      expect(props).toEqual({
        'aria-label': '테스트 레이블',
        'aria-describedby': 'test-desc',
        'aria-required': true,
        'aria-invalid': true,
        'aria-disabled': true,
        'aria-expanded': true,
        'aria-selected': false,
        'aria-checked': true
      })
    })

    it('undefined 속성은 제외', () => {
      const state = {
        label: '테스트',
        required: true
      }

      const props = getAriaProps(state)

      expect(props).toEqual({
        'aria-label': '테스트',
        'aria-required': true
      })
      expect(props['aria-invalid']).toBeUndefined()
    })

    it('빈 상태일 때 빈 객체 반환', () => {
      const props = getAriaProps({})

      expect(props).toEqual({})
    })
  })

  describe('getContrastRatio', () => {
    it('검은색과 흰색의 대비율 21:1', () => {
      const ratio = getContrastRatio('#000000', '#ffffff')
      expect(ratio).toBeCloseTo(21, 0)
    })

    it('회색과 흰색의 대비율 계산', () => {
      const ratio = getContrastRatio('#767676', '#ffffff')
      expect(ratio).toBeGreaterThan(4.5) // WCAG AA 기준
    })

    it('같은 색상은 대비율 1:1', () => {
      const ratio = getContrastRatio('#000000', '#000000')
      expect(ratio).toBe(1)
    })

    it('파란색과 흰색의 대비율', () => {
      const ratio = getContrastRatio('#0000ff', '#ffffff')
      expect(ratio).toBeGreaterThan(7) // WCAG AAA 기준 충족
    })
  })

  describe('announceToScreenReader', () => {
    beforeEach(() => {
      // DOM 초기화
      document.body.innerHTML = ''
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('polite 우선순위로 알림 생성', () => {
      announceToScreenReader('테스트 메시지', 'polite')

      const announcement = document.querySelector('[role="status"]')
      expect(announcement).toBeTruthy()
      expect(announcement?.getAttribute('aria-live')).toBe('polite')
      expect(announcement?.getAttribute('aria-atomic')).toBe('true')
      expect(announcement?.textContent).toBe('테스트 메시지')
    })

    it('assertive 우선순위로 알림 생성', () => {
      announceToScreenReader('긴급 메시지', 'assertive')

      const announcement = document.querySelector('[role="status"]')
      expect(announcement).toBeTruthy()
      expect(announcement?.getAttribute('aria-live')).toBe('assertive')
    })

    it('1초 후 알림 제거', () => {
      announceToScreenReader('테스트', 'polite')

      expect(document.querySelector('[role="status"]')).toBeTruthy()

      // 1초 경과
      jest.advanceTimersByTime(1000)

      expect(document.querySelector('[role="status"]')).toBeFalsy()
    })

    it('기본 우선순위는 polite', () => {
      announceToScreenReader('테스트')

      const announcement = document.querySelector('[role="status"]')
      expect(announcement?.getAttribute('aria-live')).toBe('polite')
    })
  })
})
