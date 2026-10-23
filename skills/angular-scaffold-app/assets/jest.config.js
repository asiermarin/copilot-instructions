module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup.jest.ts'],
  testEnvironment: 'jsdom',
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.routing.ts',
    '!src/app/app.config.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, lines: 80, functions: 80, branches: 70 },
  },
  coverageReporters: ['lcov', 'text-summary'],
  reporters: ['default', ['jest-sonar', { reportedFilePath: 'absolute' }]],
  moduleNameMapper: {
    '@ngx-translate/core': '<rootDir>/src/__mocks__/@ngx-translate/core.ts',
  },
};
