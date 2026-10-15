import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  agentInstallationPath,
  compatibility,
  declaredAgentName,
  loadAgentCatalog,
  parseAgentManifest,
  renderAgent,
  restrictionEnforcement,
  tomlMultiline,
  tomlString,
} from '../packages/core/dist/index.js';
import type { AgentManifest } from '../packages/core/dist/index.js';
import { validateAgents } from '../packages/validator/dist/index.js';
import { installAgent } from '../packages/cli/src/agent-install.js';
import { cleanup, makeSkill, temporaryDirectory } from './helpers.js';

const bundledAgents = fileURLToPath(new URL('../agents', import.meta.url));
const bundledSkills = fileURLToPath(new URL('../skills', import.meta.url));

const manifest = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  id: 'sample-agent',
  name: 'Sample Agent',
  description: 'Reviews samples. Use when a sample needs review.',
  responsibilities: ['Review samples.'],
  activation: ['A sample needs review.'],
  capabilities: ['read'],
  tools: ['read', 'search'],
  skills: ['sample-skill'],
  instructions: 'Read the sample and report findings.',
  constraints: ['Do not modify samples.'],
  outputs: ['A list of findings.'],
  verification: ['Each finding has a location.'],
  platforms: { claude: {}, codex: {} },
  ...overrides,
});

// JSON is valid YAML, so fixtures need no YAML serializer.
async function writeAgent(
  root: string,
  value: unknown,
  folder = 'sample-agent',
): Promise<string> {
  const directory = path.join(root, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'agent.yaml'),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  );
  return directory;
}

describe('bundled agents', () => {
  it('pass strict validation with every related skill resolved', async () => {
    expect(
      await validateAgents(bundledAgents, { skillCatalog: bundledSkills }),
    ).toEqual({ valid: true, agents: 8, diagnostics: [] });
  });

  it('define the eight specified agents and their related skills', async () => {
    const agents = await loadAgentCatalog(bundledAgents);
    expect(
      Object.fromEntries(
        agents.map(({ manifest }) => [manifest.id, manifest.skills]),
      ),
    ).toEqual({
      'ai-engineer': ['ai-agent-architect'],
      'backend-specialist': [
        'api-architect',
        'python-engineer',
        'database-architect',
      ],
      'code-reviewer': ['code-auditor', 'performance-engineer'],
      'devops-specialist': ['devops-engineer'],
      'frontend-specialist': [
        'ui-architect',
        'react-engineer',
        'nextjs-engineer',
      ],
      'qa-engineer': ['test-engineer', 'bug-investigator'],
      'security-auditor': ['security-reviewer'],
      'software-architect': [
        'api-architect',
        'database-architect',
        'performance-engineer',
      ],
    });
    for (const { manifest } of agents) {
      expect(manifest.description, manifest.id).toMatch(/\bUse when\b/);
      expect(Object.keys(manifest.platforms).sort()).toEqual([
        'claude',
        'codex',
      ]);
    }
  });

  it('keep review agents free of edit tools on Claude', async () => {
    const agents = await loadAgentCatalog(bundledAgents);
    for (const id of [
      'security-auditor',
      'code-reviewer',
      'software-architect',
    ]) {
      const agent = agents.find((item) => item.manifest.id === id)!;
      expect(agent.manifest.restrictions).toContain('edit');
      const content = renderAgent(agent.manifest, 'claude').content;
      expect(content).not.toMatch(/^tools:.*\b(Edit|Write)\b/m);
    }
  });
});

describe('agent manifest validation', () => {
  let root: string;
  let skills: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
    skills = path.join(root, 'skills');
    await makeSkill(path.join(skills, 'development'));
  });
  afterEach(async () => cleanup(root));
  const agents = () => path.join(root, 'agents');
  const codes = async (target = agents()) =>
    (await validateAgents(target, { skillCatalog: skills })).diagnostics.map(
      (item) => item.code,
    );

  it('accepts a minimal valid agent and a single agent directory', async () => {
    const directory = await writeAgent(agents(), manifest());
    expect(await codes()).toEqual([]);
    expect(await validateAgents(directory, { skillCatalog: skills })).toEqual({
      valid: true,
      agents: 1,
      diagnostics: [],
    });
  });

  it.each([
    ['invalid YAML', 'id: [unclosed', 'AGENT_YAML'],
    ['YAML aliases', 'a: &x 1\nb: *x\n', 'AGENT_YAML'],
    ['duplicate YAML keys', 'id: a\nid: b\n', 'AGENT_YAML'],
    [
      'a missing required field',
      manifest({ verification: undefined }),
      'AGENT_SCHEMA',
    ],
    [
      'an unknown field',
      manifest({ permissionMode: 'bypassPermissions' }),
      'AGENT_SCHEMA',
    ],
    [
      'an unknown tool category',
      manifest({ tools: ['read', 'sudo'] }),
      'AGENT_SCHEMA',
    ],
    ['an invalid identifier', manifest({ id: '../escape' }), 'AGENT_SCHEMA'],
    [
      'an invalid skill name',
      manifest({ skills: ['Bad Name'] }),
      'AGENT_SCHEMA',
    ],
    [
      'an unknown platform setting',
      manifest({ platforms: { claude: { model: 'x' } } }),
      'AGENT_SCHEMA',
    ],
    [
      'a capability not granted',
      manifest({ capabilities: ['edit'] }),
      'INVALID_TOOL',
    ],
    [
      'a restriction that is granted',
      manifest({ restrictions: ['read'] }),
      'INVALID_TOOL',
    ],
    [
      'a duplicate tool',
      manifest({ tools: ['read', 'read'] }),
      'DUPLICATE_ENTRY',
    ],
    [
      'a missing related skill',
      manifest({ skills: ['absent-skill'] }),
      'MISSING_SKILL',
    ],
    [
      'an unsupported platform',
      manifest({ platforms: { claude: {}, cursor: {} } }),
      'UNSUPPORTED_PLATFORM',
    ],
    ['no platform', manifest({ platforms: {} }), 'NO_PLATFORM'],
    [
      'an unacknowledged unenforceable restriction',
      manifest({ restrictions: ['edit'] }),
      'UNENFORCED_RESTRICTION',
    ],
    [
      'a stale acknowledgement',
      manifest({ platforms: { claude: { unenforced: ['edit'] }, codex: {} } }),
      'STALE_ACKNOWLEDGEMENT',
    ],
  ])('reports %s', async (_label, value, code) => {
    await writeAgent(agents(), value);
    expect(await codes()).toContain(code);
    expect(
      (await validateAgents(agents(), { skillCatalog: skills })).valid,
    ).toBe(false);
  });

  it('requires acknowledgement only where enforcement is incomplete', async () => {
    // Without shell, Claude removes edit tools entirely; Codex cannot.
    await writeAgent(
      agents(),
      manifest({
        restrictions: ['edit', 'shell'],
        platforms: { claude: {}, codex: { unenforced: ['edit'] } },
      }),
    );
    expect(await codes()).toEqual([]);
  });

  it('reports mismatched folders, duplicates, and missing manifests', async () => {
    await writeAgent(agents(), manifest());
    await writeAgent(agents(), manifest(), 'copy-of-agent');
    await mkdir(path.join(agents(), 'empty-agent'));
    const found = await codes();
    expect(found).toEqual(
      expect.arrayContaining([
        'ID_MISMATCH',
        'DUPLICATE_AGENT',
        'MISSING_MANIFEST',
      ]),
    );
    await expect(loadAgentCatalog(agents())).rejects.toThrow();
  });

  it('warns about files that no adapter uses', async () => {
    const directory = await writeAgent(agents(), manifest());
    await writeFile(path.join(directory, 'run.sh'), 'echo never executed');
    const result = await validateAgents(agents(), { skillCatalog: skills });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'UNEXPECTED_FILE', severity: 'warning' }),
    ]);
  });

  it('reports an unreadable skill catalog instead of skipping dependency checks', async () => {
    await writeAgent(agents(), manifest());
    const result = await validateAgents(agents(), {
      skillCatalog: path.join(root, 'absent'),
    });
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'SKILL_CATALOG',
    );
  });

  it('rejects linked agent directories', async () => {
    const outside = await writeAgent(path.join(root, 'outside'), manifest());
    await mkdir(agents());
    await symlink(outside, path.join(agents(), 'sample-agent'), 'junction');
    expect(await codes()).toContain('DISCOVERY');
  });
});

describe('platform adapters', () => {
  const parsed = (overrides: Record<string, unknown> = {}) =>
    parseAgentManifest(JSON.stringify(manifest(overrides))) as AgentManifest;

  it('accepts a manifest saved with a byte order mark', () => {
    expect(parseAgentManifest(`\uFEFF${JSON.stringify(manifest())}`).id).toBe(
      'sample-agent',
    );
  });

  it('maps tool categories to a Claude allowlist and preloads skills', () => {
    const { content, fileName } = renderAgent(
      parsed({ tools: ['read', 'search', 'shell'] }),
      'claude',
    );
    expect(fileName).toBe('sample-agent.md');
    expect(content.startsWith('---\nname: sample-agent\n')).toBe(true);
    expect(content).toContain('tools: Read, Grep, Glob, Bash\n');
    expect(content).toContain('skills:\n  - sample-skill\n');
    expect(declaredAgentName(content, 'claude')).toBe('sample-agent');
    expect(content).not.toMatch(/permissionMode|model:|hooks:/);
  });

  it('generates Codex TOML with only documented keys', () => {
    const { content, fileName } = renderAgent(parsed(), 'codex');
    expect(fileName).toBe('sample-agent.toml');
    const keys = [...content.matchAll(/^([a-z_]+) = /gm)].map((m) => m[1]);
    expect(keys).toEqual([
      'name',
      'description',
      'developer_instructions',
      'shell_tool',
    ]);
    expect(content).toContain('[features]\nshell_tool = false\n');
    expect(content).toContain('not attached to this agent automatically');
    expect(content).not.toMatch(/sandbox_mode|approval_policy|mcp_servers/);
    expect(declaredAgentName(content, 'codex')).toBe('sample-agent');
  });

  it('omits the features table when the shell is granted', () => {
    expect(
      renderAgent(parsed({ tools: ['read', 'shell'] }), 'codex').content,
    ).not.toContain('[features]');
  });

  it('escapes TOML strings so instructions cannot break out', () => {
    expect(tomlString('a "quote" \\ path\nnext\u0001')).toBe(
      '"a \\"quote\\" \\\\ path\\nnext\\u0001"',
    );
    const multiline = tomlMultiline('end """\nname = "evil"\n\\');
    expect(multiline).toBe('"""\nend \\"\\"\\"\nname = \\"evil\\"\n\\\\"""');
    const { content } = renderAgent(
      parsed({ instructions: 'Line """ injected' }),
      'codex',
    );
    expect(content).toContain('Line \\"\\"\\" injected');
    // Only the real opening and closing delimiters remain unescaped.
    expect(content.match(/(?<!\\)"""/g)).toHaveLength(2);
  });

  it('reports enforcement honestly per platform', () => {
    expect(restrictionEnforcement('claude', ['read'], 'edit')).toBe('enforced');
    expect(restrictionEnforcement('claude', ['read', 'shell'], 'edit')).toBe(
      'partial',
    );
    expect(restrictionEnforcement('codex', ['read'], 'shell')).toBe('enforced');
    expect(restrictionEnforcement('codex', ['read'], 'edit')).toBe(
      'instruction-only',
    );
    const codex = compatibility(parsed({ restrictions: ['edit'] }), 'codex');
    expect(codex.skills).toBe('referenced-in-instructions');
    expect(codex.restrictions).toContainEqual({
      category: 'edit',
      critical: true,
      enforcement: 'instruction-only',
    });
    expect(codex.notes.join(' ')).toMatch(/cannot set sandbox_mode/);
    expect(compatibility(parsed(), 'claude').skills).toBe('preloaded');
  });

  it('states restrictions in the generated instructions', () => {
    const { content } = renderAgent(
      parsed({ restrictions: ['edit'] }),
      'codex',
    );
    expect(content).toContain(
      '- edit (critical): not enforced by the platform; you must not use it regardless',
    );
  });
});

describe('agent installation paths', () => {
  it.each([
    ['claude', 'project', ['.claude', 'agents', 'sample-agent.md']],
    ['claude', 'user', ['.claude', 'agents', 'sample-agent.md']],
    ['codex', 'project', ['.codex', 'agents', 'sample-agent.toml']],
    ['codex', 'user', ['.codex', 'agents', 'sample-agent.toml']],
  ] as const)('maps %s at %s scope', (platform, scope, segments) => {
    const project = path.resolve('work', 'project with spaces');
    const home = path.resolve('work', 'home');
    expect(
      agentInstallationPath({
        platform,
        scope,
        id: 'sample-agent',
        project,
        home,
      }).target,
    ).toBe(path.join(scope === 'project' ? project : home, ...segments));
  });

  it.each(['../escape', 'a/b', 'a\\b', 'con', 'Upper', ''])(
    'rejects the unsafe identifier %j',
    (id) => {
      expect(() =>
        agentInstallationPath({
          platform: 'claude',
          scope: 'project',
          id,
          project: path.resolve('p'),
          home: path.resolve('h'),
        }),
      ).toThrow();
    },
  );
});

describe('isolated agent installation', () => {
  let root: string;
  let project: string;
  let home: string;
  let skills: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
    project = path.join(root, 'project with spaces');
    home = path.join(root, 'home');
    skills = path.join(root, 'skills');
    await mkdir(project);
    await mkdir(home);
    await makeSkill(path.join(skills, 'development'));
    await writeAgent(path.join(root, 'agents'), manifest());
  });
  afterEach(async () => cleanup(root));

  const install = async (overrides: Record<string, unknown> = {}) => {
    const [agent] = await loadAgentCatalog(path.join(root, 'agents'));
    return installAgent({
      agent: agent!,
      platform: 'claude',
      scope: 'project',
      project,
      home,
      skillCatalog: skills,
      ...overrides,
    });
  };

  it.each([
    ['claude', 'project', ['.claude', 'agents', 'sample-agent.md']],
    ['codex', 'project', ['.codex', 'agents', 'sample-agent.toml']],
    ['claude', 'user', ['.claude', 'agents', 'sample-agent.md']],
    ['codex', 'user', ['.codex', 'agents', 'sample-agent.toml']],
  ] as const)(
    'installs for %s at %s scope',
    async (platform, scope, segments) => {
      const result = await install({ platform, scope });
      expect(result.target).toBe(
        path.join(scope === 'project' ? project : home, ...segments),
      );
      expect(result.replaced).toBe(false);
      expect(
        declaredAgentName(await readFile(result.target, 'utf8'), platform),
      ).toBe('sample-agent');
      expect(result.skills).toEqual([
        { name: 'sample-skill', status: 'missing' },
      ]);
    },
  );

  it('refuses to overwrite without authorization and replaces with it', async () => {
    const { target } = await install();
    await writeFile(target, '---\nname: sample-agent\n---\nlocal edits\n');
    await expect(install()).rejects.toThrow(/already exists/);
    expect(await readFile(target, 'utf8')).toContain('local edits');
    await expect(
      install({ confirmOverwrite: async () => false }),
    ).rejects.toThrow(/already exists/);
    const replaced = await install({ confirmOverwrite: async () => true });
    expect(replaced.replaced).toBe(true);
    expect(await readFile(target, 'utf8')).not.toContain('local edits');
    expect((await install({ overwrite: true })).replaced).toBe(true);
  });

  it('refuses a different file that declares the same agent name', async () => {
    const directory = path.join(project, '.codex', 'agents');
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, 'custom.toml'),
      'name = "sample-agent"\ndescription = "x"\ndeveloper_instructions = "x"\n',
    );
    await expect(install({ platform: 'codex' })).rejects.toThrow(
      /already declares an agent named/,
    );
  });

  it('installs missing related skills on request without replacing existing ones', async () => {
    const first = await install({ withSkills: true });
    const skillTarget = path.join(project, '.claude', 'skills', 'sample-skill');
    expect(first.skills).toEqual([
      { name: 'sample-skill', status: 'installed', location: skillTarget },
    ]);
    await writeFile(path.join(skillTarget, 'local.md'), 'kept');
    const second = await install({ withSkills: true, overwrite: true });
    expect(second.skills[0]).toMatchObject({ status: 'present' });
    expect(await readFile(path.join(skillTarget, 'local.md'), 'utf8')).toBe(
      'kept',
    );
  });

  it('finds related skills installed at user scope for a project install', async () => {
    await makeSkill(path.join(home, '.agents', 'skills'));
    const result = await install({ platform: 'codex' });
    expect(result.skills[0]).toMatchObject({
      status: 'present',
      location: path.join(home, '.agents', 'skills', 'sample-skill'),
    });
  });

  it('rejects platforms the agent does not declare', async () => {
    await writeAgent(
      path.join(root, 'agents'),
      manifest({ platforms: { claude: {} } }),
    );
    await expect(install({ platform: 'codex' })).rejects.toThrow(
      /does not declare support for codex/,
    );
  });

  it('rejects invalid manifests before writing anything', async () => {
    await writeAgent(
      path.join(root, 'agents'),
      manifest({ skills: ['absent-skill'] }),
    );
    await expect(install()).rejects.toThrow(/MISSING_SKILL/);
    await expect(
      readFile(path.join(project, '.claude', 'agents', 'sample-agent.md')),
    ).rejects.toThrow();
  });

  it('rejects linked destinations and non-file targets', async () => {
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    await mkdir(path.join(project, '.claude'));
    await symlink(outside, path.join(project, '.claude', 'agents'), 'junction');
    await expect(install()).rejects.toThrow(/Symlinks and junctions/);

    await mkdir(path.join(project, '.codex', 'agents', 'sample-agent.toml'), {
      recursive: true,
    });
    await expect(
      install({ platform: 'codex', overwrite: true }),
    ).rejects.toThrow(/not a regular file/);
  });
});
