import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const environment = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']
      .filter(name => !environment[name]?.trim());
    if (missing.length) {
      throw new Error(`Falten variables de connexió: ${missing.join(', ')}. Configura-les a l’entorn de desplegament de Vercel i torna a desplegar.`);
    }
  }
  return {
  plugins: [react()],
  server: {
    port: 5173, strictPort: true,
    fs: { deny: ['.env', '.env.*', '**/*.{crt,pem}', '**/data/questions*', '**/data/question-bank/**', '**/data/question-bank-1000/**', '**/questions_1000.xlsx', '**/_question_bank/**', '**/*questions_pack.zip', '**/question_review_issues.csv', '**/assets/reference/people/**', '**/assets/production/avatars/**', '**/supabase/**', '**/security/**'] },
  },
  test: { include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.spec.ts'], environment: 'node' },
  };
});
