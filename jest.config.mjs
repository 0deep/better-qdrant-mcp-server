/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/build/__tests__/**/*.test.js'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  rootDir: './',
  roots: ['<rootDir>/build'],

  transformIgnorePatterns: [
    'node_modules/(?!(@langchain|uuid))',
  ],
};