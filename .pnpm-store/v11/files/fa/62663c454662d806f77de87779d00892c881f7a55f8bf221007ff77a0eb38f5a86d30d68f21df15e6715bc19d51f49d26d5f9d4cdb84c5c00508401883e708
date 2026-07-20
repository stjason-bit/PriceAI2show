// src/config/zod-4.ts
import { z } from "zod";
var metaSchema = z.object({
  title: z.string().optional(),
  pages: z.array(z.string()).optional(),
  description: z.string().optional(),
  root: z.boolean().optional(),
  defaultOpen: z.boolean().optional(),
  icon: z.string().optional()
});
var frontmatterSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  full: z.boolean().optional(),
  // Fumadocs OpenAPI generated
  _openapi: z.looseObject({}).optional()
});

// src/config/define.ts
function defineCollections(options) {
  return options;
}
function defineDocs(options) {
  if (!options)
    console.warn(
      "[`source.config.ts`] Deprecated: please pass options to `defineDocs()` and specify a `dir`."
    );
  const dir = options?.dir ?? "content/docs";
  return {
    type: "docs",
    dir,
    docs: defineCollections({
      type: "doc",
      dir,
      schema: frontmatterSchema,
      ...options?.docs
    }),
    meta: defineCollections({
      type: "meta",
      dir,
      schema: metaSchema,
      ...options?.meta
    })
  };
}
function defineConfig(config = {}) {
  return config;
}

export {
  metaSchema,
  frontmatterSchema,
  defineCollections,
  defineDocs,
  defineConfig
};
