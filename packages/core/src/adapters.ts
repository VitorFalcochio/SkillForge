import path from 'node:path';
import { z } from 'zod';
import { assertPortablePath, isWithin } from './filesystem.js';
import { skillNameSchema } from './metadata.js';

export const agentSchema = z.enum(['claude', 'codex']);
export const scopeSchema = z.enum(['project', 'user']);
export type Agent = z.infer<typeof agentSchema>;
export type Scope = z.infer<typeof scopeSchema>;

/** Adapters carry host-specific paths; portable skill metadata has no host dependency. */
export const adapters = {
  claude: {
    segments: ['.claude', 'skills'],
    source: 'https://code.claude.com/docs/en/skills',
  },
  codex: {
    segments: ['.agents', 'skills'],
    source: 'https://learn.chatgpt.com/docs/build-skills',
  },
} as const;

export function installationPath(options: {
  agent: Agent;
  scope: Scope;
  name: string;
  project: string;
  home: string;
}): { base: string; root: string; target: string } {
  const agent = agentSchema.parse(options.agent);
  const scope = scopeSchema.parse(options.scope);
  const name = skillNameSchema.parse(options.name);
  assertPortablePath(name);
  if (agent === 'claude' && ['synced', 'anthropic-skills'].includes(name))
    throw new Error(`Claude reserves the skill name: ${name}`);
  const base = path.resolve(
    scope === 'project' ? options.project : options.home,
  );
  const root = path.join(base, ...adapters[agent].segments);
  const target = path.join(root, name);
  if (!isWithin(root, target) || target === root)
    throw new Error('Installation target escapes the skills directory.');
  return { base, root, target };
}
