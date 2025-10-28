/**
 * Jest 셋업 파일
 *
 * 모든 테스트 실행 전 실행되는 설정
 */

// 환경 변수 설정
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_SECRET = 'test-secret-for-jest'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

// 글로벌 테스트 타임아웃
jest.setTimeout(10000)

// 콘솔 에러/경고 필터링 (테스트 중 불필요한 로그 제거)
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  console.error = (...args) => {
    // Prisma 클라이언트 경고 무시
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('prisma') || args[0].includes('Prisma'))
    ) {
      return
    }
    originalError.call(console, ...args)
  }

  console.warn = (...args) => {
    // React 경고 무시
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})
