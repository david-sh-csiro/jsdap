import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    open: resolve(__dirname, './index.html')
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/index.js'),
      name: 'jsdap',
      // the proper extensions will be added
      fileName: 'jsdap',
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {},
      },
    },
  },
})