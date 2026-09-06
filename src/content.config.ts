import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // 扩展 Starlight 的 frontmatter schema,
      // 允许 remark-reading-time 插件注入的字数与阅读时间字段,以及文章发布日期
      extend: z.object({
        pubDate: z.string().optional(),
        minutesRead: z.string().optional(),
        words: z.number().optional(),
      }),
    }),
  }),
};
