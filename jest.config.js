module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/ui/**/*.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Mock modules
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts',
    '^juice$': '<rootDir>/src/__mocks__/juice.ts',
  },
};
