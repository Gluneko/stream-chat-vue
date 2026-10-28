import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// 部署在 gluneko.github.io/Gluneko/me/chat-vue/;dev 与 preview 也用同一个 base,避免资源路径不一致
export default defineConfig({
  plugins: [vue()],
  base: '/Gluneko/me/chat-vue/',
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
