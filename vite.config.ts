import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { localPilotCollector } from './server/pilot-collector.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localPilotCollector()],
  server: { host: '127.0.0.1', fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/pilot-responses/**'] } },
  preview: { host: '127.0.0.1' },
})
