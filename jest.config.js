module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/test/**/*.e2e-spec.ts'
  ],
  moduleNameMapper: {
    '^@naver/(.*)$': '<rootDir>/src/naver/$1',
    '^@llm/(.*)$': '<rootDir>/src/llm/$1',
    '^@chrom/(.*)$': '<rootDir>/src/chrom/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/__tests__/**',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000, // E2E 테스트를 위한 타임아웃 증가
};
