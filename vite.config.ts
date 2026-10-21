import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appShellPwa } from './pwa/plugin'

export default defineConfig({
  plugins: [react(), appShellPwa()],
})
