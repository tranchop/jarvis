import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Política de segurança de conteúdo (CSP): o navegador só executa código
// do próprio site e só conversa com o Supabase do Jarvis.
function csp(supabaseUrl: string): Plugin {
  return {
    name: 'jarvis-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const origin = new URL(supabaseUrl).origin
      const ws = origin.replace('https://', 'wss://')
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self' ${origin} ${ws}`,
        "manifest-src 'self'",
        "worker-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ')
      return html.replace(
        '<!--CSP-->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
  if (mode === 'production' && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)) {
    throw new Error('VITE_SUPABASE_URL ausente ou inválida no build de produção.')
  }
  return {
    base: '/jarvis/',
    build: { sourcemap: false },
    plugins: [
      react(),
      csp(supabaseUrl),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Jarvis',
          short_name: 'Jarvis',
          description: 'Organização pessoal de Pedro',
          lang: 'pt-BR',
          start_url: '/jarvis/',
          scope: '/jarvis/',
          display: 'standalone',
          background_color: '#0e1116',
          theme_color: '#0e1116',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Só arquivos do app ficam em cache. Dados do Supabase nunca são
          // guardados no aparelho pelo service worker.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: 'index.html',
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  }
})
