import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      // 扩展 Starlight 的 frontmatter schema,
      // 允许文章标签、首次发布时间、最新更新时间,以及 remark-reading-time 插件注入的字段
      extend: z.object({
        tags: z.array(z.string()).default([]),
        pubDate: z.string().optional(),
        updatedDate: z.string().optional(),
        minutesRead: z.string().optional(),
        words: z.number().optional(),
      }),
    }),
  }),
};
