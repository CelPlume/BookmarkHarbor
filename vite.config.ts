import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname,
            '@core': new URL('./src/core', import.meta.url).pathname,
            '@components': new URL('./src/components', import.meta.url).pathname,
        },
    },
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        { name: 'vendor', test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/ },
                        { name: 'i18n', test: /[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/ },
                        { name: 'icons', test: /[\\/]node_modules[\\/]@iconify[\\/]/ },
                    ],
                },
            },
        },
    },
});
