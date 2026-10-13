import { defineConfig } from 'vite';
export default defineConfig({
  define: { __VUE_OPTIONS_API__: false, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false },
  esbuild: { jsxFactory: 'h', jsxFragment: 'Fragment' },
  server: { fs: { deny: ['.env', '.env.*', '**/.git/**', '**/private_ground_truth/**', '**/radar-simulator/**'] } },
});
