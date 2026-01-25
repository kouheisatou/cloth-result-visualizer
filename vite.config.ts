import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Inject base tag dynamically based on the base config
        return html.replace(
          '<head>',
          `<head>\n    <base href="${process.env.NODE_ENV === 'production' ? '/cloth-result-visualizer/' : '/'}" />`
        );
      },
    },
  ],
  base: '/cloth-result-visualizer/',
})
