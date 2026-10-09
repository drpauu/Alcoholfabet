import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, strictPort: true,
    fs: { deny: ['.env', '.env.*', '**/*.{crt,pem}', '**/data/questions_approved.json', '**/assets/reference/people/**', '**/assets/production/avatars/**', '**/supabase/**', '**/security/**'] },
  },
  test: { include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'], environment: 'node' },
});
