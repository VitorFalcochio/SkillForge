import { parseDocument } from 'yaml';
import { z } from 'zod';

export const skillNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase ASCII letters, digits, and single hyphens; no leading or trailing hyphen.',
  );

export const skillMetadataSchema = z
  .object({
    name: skillNameSchema,
    description: z
      .string()
      .min(1)
      .max(1024)
      .refine(
        (value) => value.trim().length > 0,
        'Description must not be blank.',
      ),
    license: z.string().min(1).optional(),
    compatibility: z.string().min(1).max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    'allowed-tools': z.string().min(1).optional(),
  })
  .passthrough();

export type SkillMetadata = z.infer<typeof skillMetadataSchema>;

export interface SkillDocument {
  metadata: SkillMetadata;
  body: string;
  /** Number of lines before the Markdown body, for source diagnostics. */
  bodyOffset: number;
}

export class SkillParseError extends Error {
  constructor(
    public readonly code: 'FRONTMATTER' | 'YAML' | 'METADATA',
    message: string,
  ) {
    super(message);
    this.name = 'SkillParseError';
  }
}

export function parseSkill(text: string): SkillDocument {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match)
    throw new SkillParseError(
      'FRONTMATTER',
      'Start SKILL.md with YAML between two --- lines.',
    );
  let value: unknown;
  try {
    const document = parseDocument(match[1]!, { uniqueKeys: true });
    if (document.errors.length)
      throw new Error(document.errors.map((error) => error.message).join('; '));
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new SkillParseError(
      'YAML',
      `Fix YAML syntax (aliases are not supported): ${errorMessage(error)}`,
    );
  }
  const parsed = skillMetadataSchema.safeParse(value);
  if (!parsed.success) {
    throw new SkillParseError(
      'METADATA',
      parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
        )
        .join('; '),
    );
  }
  return {
    metadata: parsed.data,
    body: normalized.slice(match[0].length),
    bodyOffset: match[0].split('\n').length - 1,
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
