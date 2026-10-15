import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('jest').Config} */
export default {
  ...createDefaultEsmPreset({ tsconfig: '<rootDir>/tsconfig.json' }),
  // A fake browser DOM, so components can render inside Node.
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  clearMocks: true,
};
