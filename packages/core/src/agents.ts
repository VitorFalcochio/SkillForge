import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import {
  assertNoSymlinks,
  exists,
  readTextFile,
  walkSkill,
} from './filesystem.js';
import { errorMessage, skillNameSchema } from './metadata.js';

/**
 * Portable agent manifests (`agents/<id>/agent.yaml`). Platform files are
 * generated from these by the adapters; nothing in a manifest is executed.
 */
export const AGENT_MANIFEST = 'agent.yaml';

/** Tool categories, mapped to concrete tools per platform by the adapters. */
export const toolCategorySchema = z.enum([
  'read',
  'search',
  'edit',
  'shell',
  'web',
]);
export type ToolCategory = z.infer<typeof toolCategorySchema>;

export const platformSchema = z.enum(['claude', 'codex']);
export type Platform = z.infer<typeof platformSchema>;

const line = z.string().trim().min(1).max(500);
const list = (max: number) => z.array(line).min(1).max(max);

const platformSettingsSchema = z.strictObject({
  /** Critical restrictions this platform cannot fully enforce, acknowledged by the author. */
  unenforced: z.array(toolCategorySchema).max(5).optional(),
});

export const agentManifestSchema = z.strictObject({
  version: z.literal(1),
  id: skillNameSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(1024),
  responsibilities: list(20),
  activation: list(20),
  capabilities: z.array(toolCategorySchema).min(1).max(5),
  tools: z.array(toolCategorySchema).min(1).max(5),
  restrictions: z.array(toolCategorySchema).max(5).optional(),
  // Claude Code preloads at most 32 skills; keep manifests within that bound.
  skills: z.array(skillNameSchema).max(32).optional(),
  instructions: z.string().trim().min(1).max(20000),
  constraints: list(30),
  outputs: list(20),
  verification: list(20),
  // Keys are checked by the validator so unknown platforms get a specific diagnostic.
  platforms: z.record(z.string(), platformSettingsSchema),
});
export type AgentManifest = z.infer<typeof agentManifestSchema>;

export class AgentParseError extends Error {
  constructor(
    public readonly code: 'AGENT_YAML' | 'AGENT_SCHEMA',
    message: string,
  ) {
    super(message);
    this.name = 'AgentParseError';
  }
}

export function parseAgentManifest(text: string): AgentManifest {
  let value: unknown;
  try {
    const document = parseDocument(text.replace(/^\uFEFF/, ''), {
      uniqueKeys: true,
    });
    if (document.errors.length)
      throw new Error(document.errors.map((error) => error.message).join('; '));
    value = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new AgentParseError(
      'AGENT_YAML',
      `Fix YAML syntax (aliases are not supported): ${errorMessage(error)}`,
    );
  }
  const parsed = agentManifestSchema.safeParse(value);
  if (!parsed.success)
    throw new AgentParseError(
      'AGENT_SCHEMA',
      parsed.error.issues
        .map(
          (issue) => `${issue.path.join('.') || 'manifest'}: ${issue.message}`,
        )
        .join('; '),
    );
  return parsed.data;
}

/**
 * Find agent directories: the target itself when it holds a manifest, otherwise
 * each non-hidden child directory. Links and special files are rejected.
 */
export async function discoverAgentDirectories(
  root: string,
): Promise<string[]> {
  root = path.resolve(root);
  await assertNoSymlinks(root);
  if (!(await lstat(root)).isDirectory())
    throw new Error(`Expected a directory: ${root}`);
  if (await exists(path.join(root, AGENT_MANIFEST))) return [root];
  const found: string[] = [];
  for (const name of (await readdir(root)).sort()) {
    if (name.startsWith('.')) continue;
    const target = path.join(root, name);
    const stat = await lstat(target);
    if (stat.isSymbolicLink())
      throw new Error(`Symlinks and junctions are not allowed: ${target}`);
    if (stat.isDirectory()) found.push(target);
  }
  return found;
}

export interface CatalogAgent {
  manifest: AgentManifest;
  directory: string;
}

/** Load agent manifests for listing and installation; refuses ambiguous catalogs. */
export async function loadAgentCatalog(root: string): Promise<CatalogAgent[]> {
  const agents: CatalogAgent[] = [];
  const ids = new Set<string>();
  for (const directory of await discoverAgentDirectories(root)) {
    await walkSkill(directory);
    const manifest = parseAgentManifest(
      await readTextFile(path.join(directory, AGENT_MANIFEST)),
    );
    if (manifest.id !== path.basename(directory))
      throw new Error(`Agent id must match its folder: ${directory}`);
    if (ids.has(manifest.id))
      throw new Error(`Duplicate agent identifier: ${manifest.id}`);
    ids.add(manifest.id);
    agents.push({ manifest, directory });
  }
  return agents.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
}
