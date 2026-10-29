import { defineConfig } from 'vitest/config';

// Test Security Rules: jalankan lewat `npm run test:rules` (menyalakan Firebase Emulator Suite).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests-rules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false, // semua file memakai satu emulator
  },
});
