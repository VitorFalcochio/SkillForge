import path from 'node:path';
import { Document, parseDocument } from 'yaml';
import type { AgentManifest, Platform, ToolCategory } from './agents.js';
import { platformSchema } from './agents.js';
import { scopeSchema } from './adapters.js';
import type { Scope } from './adapters.js';
import { assertPortablePath, isWithin } from './filesystem.js';
import { skillNameSchema } from './metadata.js';

/**
 * Platform adapters for agent manifests. Field names and behavior follow:
 * - Claude Code subagents: https://code.claude.com/docs/en/sub-agents
 * - Codex custom agents: https://learn.chatgpt.com/docs/agent-configuration/subagents
 * Both checked on October 15, 2026. Only documented fields are generated.
 */
export const agentPlatforms = {
  claude: {
    label: 'Claude Code',
    segments: ['.claude', 'agents'],
    extension: '.md',
    skillSegments: ['.claude', 'skills'],
    source: 'https://code.claude.com/docs/en/sub-agents',
  },
  codex: {
    label: 'OpenAI Codex',
    segments: ['.codex', 'agents'],
    extension: '.toml',
    skillSegments: ['.agents', 'skills'],
    source: 'https://learn.chatgpt.com/docs/agent-configuration/subagents',
  },
} as const;

/** Claude Code tool names granted per category through the `tools` allowlist. */
export const claudeTools: Record<ToolCategory, string[]> = {
  read: ['Read'],
  search: ['Grep', 'Glob'],
  edit: ['Edit', 'Write', 'NotebookEdit'],
  shell: ['Bash'],
  web: ['WebFetch', 'WebSearch'],
};

/**
 * How a platform treats a tool category the agent may not use:
 * - enforced: the platform removes the capability.
 * - partial: dedicated tools are removed, but an allowed shell can still do it.
 * - instruction-only: only the generated instructions ask the agent to refrain.
 */
export type Enforcement = 'enforced' | 'partial' | 'instruction-only';

export function restrictionEnforcement(
  platform: Platform,
  tools: readonly ToolCategory[],
  category: ToolCategory,
): Enforcement {
  if (platform === 'claude')
    return category !== 'shell' && tools.includes('shell')
      ? 'partial'
      : 'enforced';
  // Codex agent files can disable the shell tool; sandbox, approvals, edits,
  // and web access are inherited from the parent session.
  return category === 'shell' ? 'enforced' : 'instruction-only';
}

const categories: ToolCategory[] = ['read', 'search', 'edit', 'shell', 'web'];

export interface RestrictionReport {
  category: ToolCategory;
  critical: boolean;
  enforcement: Enforcement;
}

export interface CompatibilityReport {
  platform: Platform;
  skills: 'preloaded' | 'referenced-in-instructions' | 'none';
  grantedTools: string[];
  restrictions: RestrictionReport[];
  notes: string[];
}

export function compatibility(
  manifest: AgentManifest,
  platform: Platform,
): CompatibilityReport {
  const critical = new Set(manifest.restrictions ?? []);
  const restrictions = categories
    .filter((category) => !manifest.tools.includes(category))
    .map((category) => ({
      category,
      critical: critical.has(category),
      enforcement: restrictionEnforcement(platform, manifest.tools, category),
    }));
  const notes: string[] = [];
  const hasSkills = Boolean(manifest.skills?.length);
  if (platform === 'claude') {
    notes.push(
      'Permission mode, hooks, and MCP servers are inherited from the session; the generated file does not set them.',
    );
    if (manifest.tools.includes('shell'))
      notes.push(
        'Bash is granted, so edit and web restrictions remove the dedicated tools only; Bash commands remain subject to your permission settings.',
      );
    if (hasSkills)
      notes.push(
        'Related skills are preloaded through the skills field; a missing skill is skipped by Claude Code with a debug-log warning.',
      );
  } else {
    notes.push(
      'Codex agent files cannot set sandbox_mode or approval_policy; the agent inherits the parent session settings. Set a read-only sandbox on the parent session for review agents.',
    );
    if (hasSkills)
      notes.push(
        'Codex has no field to attach skills to an agent. Related skills are named in developer_instructions and must be installed separately; this is not equivalent to preloading.',
      );
  }
  return {
    platform,
    skills: !hasSkills
      ? 'none'
      : platform === 'claude'
        ? 'preloaded'
        : 'referenced-in-instructions',
    grantedTools:
      platform === 'claude'
        ? manifest.tools.flatMap((category) => claudeTools[category])
        : manifest.tools.includes('shell')
          ? ['inherited from parent session']
          : ['inherited from parent session, except the shell tool'],
    restrictions,
    notes,
  };
}

const bullets = (items: readonly string[]) =>
  items.map((item) => `- ${item}`).join('\n');

const enforcementText: Record<Enforcement, string> = {
  enforced: 'removed by the platform',
  partial: 'dedicated tools removed; do not use the shell to work around this',
  'instruction-only':
    'not enforced by the platform; you must not use it regardless',
};

/** Compose the platform-neutral system prompt, adjusted for skill delivery. */
export function renderAgentInstructions(
  manifest: AgentManifest,
  platform: Platform,
): string {
  const report = compatibility(manifest, platform);
  const skills = manifest.skills ?? [];
  const skillSection = !skills.length
    ? ''
    : platform === 'claude'
      ? `## Related skills\n\nThese skills are preloaded into your context. Follow their workflows when the task matches:\n\n${bullets(skills)}\n\n`
      : `## Related skills\n\nThese skills are not attached to this agent automatically. When the task matches, open the installed skill with this name and follow its SKILL.md. If it is not installed, say so and continue with the guidance below:\n\n${bullets(skills)}\n\n`;
  const denied = report.restrictions.map(
    (item) =>
      `- ${item.category}${item.critical ? ' (critical)' : ''}: ${enforcementText[item.enforcement]}`,
  );
  return [
    `# ${manifest.name}`,
    '',
    manifest.instructions.trim(),
    '',
    '## Responsibilities',
    '',
    bullets(manifest.responsibilities),
    '',
    '## When to engage',
    '',
    bullets(manifest.activation),
    '',
    `${skillSection}## Tool boundaries`,
    '',
    `Allowed tool categories: ${manifest.tools.join(', ')}.`,
    ...(denied.length ? ['', 'Not allowed:', '', ...denied] : []),
    '',
    '## Constraints',
    '',
    bullets(manifest.constraints),
    '',
    '## Expected outputs',
    '',
    bullets(manifest.outputs),
    '',
    '## Verification before finishing',
    '',
    bullets(manifest.verification),
    '',
  ].join('\n');
}

function claudeFile(manifest: AgentManifest): string {
  const frontmatter: Record<string, unknown> = {
    name: manifest.id,
    description: manifest.description,
    tools: manifest.tools
      .flatMap((category) => claudeTools[category])
      .join(', '),
  };
  if (manifest.skills?.length) frontmatter.skills = manifest.skills;
  const yaml = new Document(frontmatter).toString({ lineWidth: 0 });
  return `---\n${yaml}---\n\n<!-- Generated by AgentSkills from agents/${manifest.id}/agent.yaml. Edit the manifest and reinstall instead of editing this file. -->\n\n${renderAgentInstructions(manifest, 'claude')}`;
}

function tomlControl(character: string): string {
  return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

/** TOML basic string. */
export function tomlString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, tomlControl)}"`;
}

/** TOML multi-line basic string; every quote is escaped so no closing delimiter can form. */
export function tomlMultiline(value: string): string {
  const body = value
    .replace(/\r\n/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, tomlControl);
  return `"""\n${body}"""`;
}

function codexFile(manifest: AgentManifest): string {
  const lines = [
    `# Generated by AgentSkills from agents/${manifest.id}/agent.yaml. Edit the manifest and reinstall instead of editing this file.`,
    '# Codex applies the parent session sandbox and approval settings; this file cannot restrict them.',
    `name = ${tomlString(manifest.id)}`,
    `description = ${tomlString(manifest.description)}`,
    `developer_instructions = ${tomlMultiline(renderAgentInstructions(manifest, 'codex'))}`,
  ];
  if (!manifest.tools.includes('shell'))
    lines.push('', '[features]', 'shell_tool = false');
  return `${lines.join('\n')}\n`;
}

export interface RenderedAgent {
  platform: Platform;
  fileName: string;
  content: string;
  compatibility: CompatibilityReport;
}

export function renderAgent(
  manifest: AgentManifest,
  platform: Platform,
): RenderedAgent {
  platform = platformSchema.parse(platform);
  return {
    platform,
    fileName: `${manifest.id}${agentPlatforms[platform].extension}`,
    content: platform === 'claude' ? claudeFile(manifest) : codexFile(manifest),
    compatibility: compatibility(manifest, platform),
  };
}

/** Destination of a generated agent file, kept inside the platform's agent directory. */
export function agentInstallationPath(options: {
  platform: Platform;
  scope: Scope;
  id: string;
  project: string;
  home: string;
}): { base: string; root: string; target: string } {
  const platform = platformSchema.parse(options.platform);
  const scope = scopeSchema.parse(options.scope);
  const id = skillNameSchema.parse(options.id);
  const fileName = `${id}${agentPlatforms[platform].extension}`;
  assertPortablePath(fileName);
  const base = path.resolve(
    scope === 'project' ? options.project : options.home,
  );
  const root = path.join(base, ...agentPlatforms[platform].segments);
  const target = path.join(root, fileName);
  if (!isWithin(root, target) || path.dirname(target) !== root)
    throw new Error('Agent target escapes the platform agent directory.');
  return { base, root, target };
}

/** Identity declared by an existing platform agent file, used to detect name conflicts. */
export function declaredAgentName(
  text: string,
  platform: Platform,
): string | undefined {
  const normalized = text.replace(/\r\n/g, '\n');
  if (platform === 'codex')
    return /^name\s*=\s*"([^"\\]*)"\s*$/m.exec(normalized)?.[1];
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(normalized)?.[1];
  if (frontmatter === undefined) return undefined;
  const document = parseDocument(frontmatter);
  if (document.errors.length) return undefined;
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  return typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string'
    ? value.name
    : undefined;
}
