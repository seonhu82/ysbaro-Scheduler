/**
 * Jest 설정
 *
 * Next.js + TypeScript + Prisma 환경을 위한 설정
 */

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // next.config.js와 .env 파일이 있는 디렉토리 경로
  dir: './',
})

/** @type {import('jest').Config} */
const customJestConfig = {
  // 테스트 환경
  testEnvironment: 'jest-environment-node',

  // 모듈 경로 별칭 (tsconfig.json과 일치)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // 테스트 파일 패턴
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],

  // 커버리지 수집 대상
  collectCoverageFrom: [
    'src/lib/services/**/*.ts',
    'src/lib/utils/**/*.ts',
    'src/lib/validations/**/*.ts',
    '!src/lib/**/*.d.ts',
    '!src/lib/**/index.ts',
  ],

  // 커버리지 임계값 (70%)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // 셋업 파일
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // 변환 제외 (node_modules 중 일부)
  transformIgnorePatterns: [
    '/node_modules/(?!(date-fns)/)',
  ],

  // 타임아웃 (비동기 테스트용)
  testTimeout: 10000,
}

// createJestConfig는 비동기이므로 내보내기
module.exports = createJestConfig(customJestConfig)
