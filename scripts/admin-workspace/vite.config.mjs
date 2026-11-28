import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {'process.env.NODE_ENV':JSON.stringify('production')},
  build: {
    outDir: resolve(import.meta.dirname,'../../admin/workspace'),
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname,'workspace.jsx'),
      formats: ['es'],
      fileName: ()=>'workspace.js',
      cssFileName: 'workspace',
    },
    rollupOptions: {
      onwarn(warning,report) {
        if(warning.code==='MODULE_LEVEL_DIRECTIVE'&&warning.message.includes('"use client"'))return;
        report(warning);
      },
    },
  },
});
