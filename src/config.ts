import { z } from 'zod';
import { InputError } from './model.js';
import { parseJson, relativePath } from './security.js';

const safePath = z
  .string()
  .max(500)
  .refine((v) => {
    try {
      relativePath(v);
      return true;
    } catch {
      return false;
    }
  }, 'Use a relative path without traversal.');
export const configSchema = z
  .object({
    version: z.literal(1),
    docs: z.array(safePath).max(100).default([]),
    exclude: z.array(safePath).max(100).default([]),
    ignore: z
      .array(
        z
          .object({
            id: z.string().max(100),
            scope: z.string().max(500).optional(),
            reason: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    failOn: z.enum(['error', 'warning', 'suggestion', 'none']).default('error'),
    projectType: z
      .enum(['cli', 'library', 'application', 'research', 'generic'])
      .optional(),
    language: z
      .string()
      .regex(/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/)
      .default('en'),
    limits: z
      .object({
        files: z.number().int().min(1).max(50000).default(10000),
        fileBytes: z.number().int().min(100).max(2097152).default(524288),
        totalBytes: z.number().int().min(1000).max(104857600).default(20971520),
        depth: z.number().int().min(1).max(64).default(20),
      })
      .strict()
      .prefault({}),
  })
  .strict();
export type Config = z.infer<typeof configSchema>;
export function parseConfig(text?: string): Config {
  try {
    return configSchema.parse(
      text === undefined ? { version: 1 } : parseJson(text),
    );
  } catch {
    throw new InputError(
      'Invalid .repopolish.json. Use version 1, supported keys, bounded limits and relative paths; see docs/configuration.md.',
    );
  }
}
