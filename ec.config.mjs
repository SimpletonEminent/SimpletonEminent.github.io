// @ts-check
import { defineEcConfig } from 'astro-expressive-code';

/**
 * Expressive Code 自定义配置
 * 文章中的 ```npm 代码块实际是 shell 命令,把 npm 映射到 bash 语法高亮
 */
export default defineEcConfig({
  shiki: {
    langAlias: {
      // npm 代码块按 shell/bash 高亮
      npm: 'bash',
    },
  },
});
