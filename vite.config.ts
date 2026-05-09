import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

// HTTPS dev server uses mkcert-generated certs if present (./certs/).
// Camera + DeviceOrientation APIs require HTTPS on iOS Safari.
const certPath = resolve(here, 'certs/localhost+3.pem');
const keyPath = resolve(here, 'certs/localhost+3-key.pem');
const httpsCfg =
  existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined;

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 3000,
    https: httpsCfg,
  },
  preview: {
    port: 3000,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(here, 'index.html'),
      },
    },
  },
});
