import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // 扩展 Starlight 的 frontmatter schema,
      // 允许 remark-reading-time 插件注入的字数与阅读时间字段
      extend: z.object({
        minutesRead: z.string().optional(),
        words: z.number().optional(),
      }),
    }),
  }),
};
