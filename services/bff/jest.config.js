import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('jest').Config} */
export default {
  ...createDefaultEsmPreset({ tsconfig: '<rootDir>/tsconfig.json' }),
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Source files import siblings as './x.js' (NodeNext); map them back to the .ts sources.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  clearMocks: true,
};
