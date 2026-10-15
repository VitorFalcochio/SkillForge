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
