import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  makeSkill,
  skillText,
  temporaryDirectory,
} from './helpers.js';

const exec = promisify(execFile);
const cli = fileURLToPath(
  new URL('../packages/cli/dist/index.js', import.meta.url),
);
const catalog = fileURLToPath(new URL('../skills', import.meta.url));

async function run(args: string[], cwd: string) {
  try {
    const result = await exec(process.execPath, [cli, ...args], {
      cwd,
      timeout: 15000,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { ...result, code: 0 };
  } catch (error) {
    const result = error as Error & {
      code: number;
      stdout: string;
      stderr: string;
    };
    return { code: result.code, stdout: result.stdout, stderr: result.stderr };
  }
}

describe('compiled CLI smoke tests', () => {
  let root: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
  });
  afterEach(async () => cleanup(root));
  it('shows help and version', async () => {
    expect((await run(['--help'], root)).stdout).toContain('install');
    expect((await run(['--version'], root)).stdout.trim()).toBe('0.1.0');
  });
  it('discovers the bundled catalog from an unrelated working directory', async () => {
    const result = await run(['list'], root);
    expect(result.code).toBe(0);
    for (const name of [
      'ai-agent-architect',
      'api-architect',
      'bug-investigator',
      'code-auditor',
      'database-architect',
      'devops-engineer',
      'documentation-engineer',
      'nextjs-engineer',
      'performance-engineer',
      'python-engineer',
      'react-engineer',
      'security-reviewer',
      'skill-creator',
      'skill-evaluator',
      'skill-optimizer',
      'skill-reviewer',
      'test-engineer',
      'ui-architect',
    ])
      expect(result.stdout).toContain(name);
  });
  it('shows a complete skill and rejects unknown identifiers', async () => {
    expect((await run(['info', 'bug-investigator'], root)).stdout).toContain(
      'Verification criteria',
    );
    const result = await run(['info', 'missing-skill'], root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Unknown skill');
  });
  it('validates all bundled skills with zero warnings', async () => {
    const result = await run(['validate', catalog, '--strict', '--json'], root);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      valid: true,
      skills: 18,
      diagnostics: [],
    });
  });
  it('returns nonzero and actionable output for an invalid directory', async () => {
    const result = await run(['validate', root], root);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('MISSING_SKILL');
  });
  it('makes warning failure opt-in', async () => {
    const source = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText('sample-skill', ''),
    });
    expect((await run(['validate', source], root)).code).toBe(0);
    const strict = await run(['validate', source, '--strict'], root);
    expect(strict.code).toBe(1);
    expect(strict.stderr).toContain('EMPTY_BODY');
  });
  it.each(['claude', 'codex'])(
    'installs %s from an unrelated cwd and refuses noninteractive overwrite',
    async (agent) => {
      const args = [
        'install',
        'code-auditor',
        '--agent',
        agent,
        '--project',
        root,
      ];
      expect((await run(args, root)).code).toBe(0);
      const installed = path.join(
        root,
        agent === 'claude' ? '.claude' : '.agents',
        'skills',
        'code-auditor',
      );
      expect(
        await readFile(path.join(installed, 'SKILL.md'), 'utf8'),
      ).toContain('name: code-auditor');
      const duplicate = await run(args, root);
      expect(duplicate.code).toBe(1);
      expect(duplicate.stderr).toContain('--force');
      expect((await run([...args, '--force'], root)).code).toBe(0);
    },
  );
  it('supports a custom local catalog', async () => {
    const custom = path.join(root, 'catalog');
    await makeSkill(custom);
    const project = path.join(root, 'project');
    await mkdir(project);
    expect((await run(['--catalog', custom, 'list'], root)).stdout).toContain(
      'sample-skill',
    );
    expect(
      (
        await run(
          [
            '--catalog',
            custom,
            'install',
            'sample-skill',
            '--agent',
            'codex',
            '--project',
            project,
          ],
          root,
        )
      ).code,
    ).toBe(0);
  });
  it('rejects missing and unsupported agent choices', async () => {
    expect((await run(['install', 'code-auditor'], root)).code).not.toBe(0);
    expect(
      (await run(['install', 'code-auditor', '--agent', 'unknown'], root)).code,
    ).not.toBe(0);
  });
  it('rejects malformed custom catalogs before installing', async () => {
    const custom = path.join(root, 'catalog');
    const source = await makeSkill(custom);
    await writeFile(path.join(source, 'SKILL.md'), '# Invalid');
    const result = await run(
      [
        '--catalog',
        custom,
        'install',
        'sample-skill',
        '--agent',
        'codex',
        '--project',
        root,
      ],
      root,
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('YAML');
  });
  it('lists, inspects, and validates the bundled agents', async () => {
    const list = await run(['agents', 'list'], root);
    expect(list.code).toBe(0);
    expect(
      list.stdout
        .trim()
        .split('\n')
        .map((line) => line.split('\t')[0]),
    ).toEqual([
      'ai-engineer',
      'backend-specialist',
      'code-reviewer',
      'devops-specialist',
      'frontend-specialist',
      'qa-engineer',
      'security-auditor',
      'software-architect',
    ]);
    const info = await run(['agents', 'info', 'security-auditor'], root);
    expect(info.stdout).toContain('Critical restrictions');
    expect(info.stdout).toContain('Not allowed: edit (critical), partial');
    expect(info.stdout).toContain(
      'Not allowed: edit (critical), instruction-only',
    );
    const codex = await run(
      ['agents', 'info', 'software-architect', '--platform', 'codex'],
      root,
    );
    expect(codex.stdout).toContain('name = "software-architect"');
    expect(codex.stdout).toContain('shell_tool = false');
    const validation = await run(
      [
        'agents',
        'validate',
        fileURLToPath(new URL('../agents', import.meta.url)),
        '--strict',
        '--json',
      ],
      root,
    );
    expect(validation.code).toBe(0);
    expect(JSON.parse(validation.stdout)).toEqual({
      valid: true,
      agents: 8,
      diagnostics: [],
    });
  });
  it('installs agents into a temporary project and refuses silent overwrite', async () => {
    const project = path.join(root, 'project');
    await mkdir(project);
    const claude = await run(
      [
        'agents',
        'install',
        'code-reviewer',
        '--platform',
        'claude',
        '--project',
        project,
      ],
      root,
    );
    expect(claude.code).toBe(0);
    expect(claude.stdout).toContain('Related skill code-auditor: missing');
    expect(claude.stderr).toContain('critical restriction "edit" is partial');
    const codex = await run(
      [
        'agents',
        'install',
        'code-reviewer',
        '--platform',
        'codex',
        '--project',
        project,
        '--with-skills',
      ],
      root,
    );
    expect(codex.code).toBe(0);
    expect(codex.stdout).toContain('Related skill code-auditor: installed');
    expect(
      await readFile(
        path.join(project, '.codex', 'agents', 'code-reviewer.toml'),
        'utf8',
      ),
    ).toContain('name = "code-reviewer"');
    const again = await run(
      [
        'agents',
        'install',
        'code-reviewer',
        '--platform',
        'claude',
        '--project',
        project,
      ],
      root,
    );
    expect(again.code).toBe(1);
    expect(again.stderr).toContain('already exists');
    const forced = await run(
      [
        'agents',
        'install',
        'code-reviewer',
        '--platform',
        'claude',
        '--project',
        project,
        '--force',
      ],
      root,
    );
    expect(forced.stdout).toContain('Replaced code-reviewer');
  });
  it('rejects unknown agents, platforms, and invalid agent trees', async () => {
    expect(
      (await run(['agents', 'info', 'missing-agent'], root)).stderr,
    ).toContain('Unknown agent');
    const platform = await run(
      ['agents', 'install', 'code-reviewer', '--platform', 'cursor'],
      root,
    );
    expect(platform.code).not.toBe(0);
    expect(platform.stderr).toContain('cursor');
    const empty = await run(['agents', 'validate', root], root);
    expect(empty.code).toBe(1);
    expect(empty.stderr).toContain('NO_AGENTS');
    await mkdir(path.join(root, 'broken'));
    const broken = await run(['agents', 'validate', root], root);
    expect(broken.code).toBe(1);
    expect(broken.stderr).toContain('MISSING_MANIFEST');
  });
  it('evaluates a bundled suite without claiming unrecorded results', async () => {
    const result = await run(['eval', 'skill-reviewer'], root);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('PASS keeps-no-execution-rule');
    expect(result.stdout).toContain('none recorded');
    const json = await run(['eval', 'skill-reviewer', '--json'], root);
    expect(JSON.parse(json.stdout)).toMatchObject({
      skill: 'skill-reviewer',
      runs: [],
    });
  });
  it('fails eval for missing suites and failed static checks', async () => {
    const missing = await run(['eval', 'api-architect'], root);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('No evaluation suite');
    const suite = path.join(root, 'suite');
    await mkdir(suite);
    await writeFile(
      path.join(suite, 'suite.json'),
      JSON.stringify({
        version: 1,
        skill: 'code-auditor',
        static: [
          {
            id: 'absent-phrase',
            file: 'SKILL.md',
            assertion: { type: 'contains', value: 'phrase that is absent' },
          },
        ],
        scenarios: [
          {
            id: 'basic',
            description: 'Basic.',
            prompt: 'Audit.',
            expected: ['Findings'],
            assertions: [{ type: 'contains', value: 'finding' }],
          },
        ],
      }),
    );
    const failed = await run(['eval', 'code-auditor', '--suite', suite], root);
    expect(failed.code).toBe(1);
    expect(failed.stdout).toContain('FAIL absent-phrase');
  });
});
