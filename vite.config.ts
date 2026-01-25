import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isProduction = command === 'build';
  const base = isProduction ? '/cloth-result-visualizer/' : '/';
  
  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // Inject base tag dynamically
          return html.replace(
            '<head>',
            `<head>\n    <base href="${base}" />`
          );
        },
      },
    ],
    base,
  };
})
