import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkText,
  evaluateSkill,
  loadCatalog,
  loadEvaluationSuite,
} from '../packages/core/dist/index.js';
import {
  cleanup,
  makeSkill,
  skillText,
  temporaryDirectory,
} from './helpers.js';

const catalog = fileURLToPath(new URL('../skills', import.meta.url));
const evals = fileURLToPath(new URL('../evals', import.meta.url));

const scenario = {
  id: 'reports-cause',
  description: 'The output names the cause.',
  prompt: 'Explain the failure in fixtures/input.txt.',
  fixtures: ['fixtures/input.txt'],
  expected: ['Names the stale cache as the cause'],
  assertions: [
    { type: 'contains', value: 'stale cache' },
    { type: 'not-contains', value: 'cannot determine' },
  ],
};

const suite = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  skill: 'sample-skill',
  static: [
    {
      id: 'keeps-evidence-rule',
      file: 'SKILL.md',
      assertion: { type: 'contains', value: 'reproducible evidence' },
    },
  ],
  scenarios: [
    scenario,
    {
      id: 'rubric-only',
      description: 'Judged by a person.',
      prompt: 'Summarize the investigation.',
      expected: ['A clear summary'],
      rubric: [{ criterion: 'Clarity', scale: '0 to 2' }],
    },
  ],
  ...overrides,
});

const result = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  skill: 'sample-skill',
  runId: 'run-1',
  recordedAt: '2026-10-15T12:00:00Z',
  condition: 'with-skill',
  agent: 'test harness',
  scenarios: [
    {
      id: 'reports-cause',
      outputFile: 'outputs/reports-cause.md',
      durationMs: 1500,
      costUsd: 0.01,
    },
  ],
  ...overrides,
});

describe('deterministic text assertions', () => {
  it('ignores case and whitespace runs by default', () => {
    expect(
      checkText('Never   execute\ncontributed scripts', {
        type: 'contains',
        value: 'never execute contributed scripts',
      }).passed,
    ).toBe(true);
    expect(
      checkText('Never execute', {
        type: 'contains',
        value: 'never execute',
        ignoreCase: false,
      }).passed,
    ).toBe(false);
  });
  it('supports negative and alternative assertions', () => {
    expect(
      checkText('approved', { type: 'not-contains', value: 'approve' }).passed,
    ).toBe(false);
    expect(
      checkText('request changes', {
        type: 'contains-any',
        values: ['reject', 'request changes'],
      }).passed,
    ).toBe(true);
  });
});

describe('evaluation suites', () => {
  let root: string;
  let skill: string;
  let suiteDirectory: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
    skill = await makeSkill(path.join(root, 'catalog'));
    suiteDirectory = path.join(root, 'evals', 'sample-skill');
    await mkdir(path.join(suiteDirectory, 'fixtures'), { recursive: true });
    await writeFile(
      path.join(suiteDirectory, 'fixtures', 'input.txt'),
      'synthetic',
    );
  });
  afterEach(async () => cleanup(root));

  const writeSuite = (value: unknown) =>
    writeFile(path.join(suiteDirectory, 'suite.json'), JSON.stringify(value));
  const writeResult = async (value: unknown, name = 'run-1.json') => {
    await mkdir(path.join(suiteDirectory, 'results', 'outputs'), {
      recursive: true,
    });
    await writeFile(
      path.join(suiteDirectory, 'results', name),
      JSON.stringify(value),
    );
  };
  const evaluate = () =>
    evaluateSkill({
      skill: 'sample-skill',
      skillDirectory: skill,
      suiteDirectory,
    });

  it('reports static checks and no runs when nothing was recorded', async () => {
    await writeSuite(suite());
    const report = await evaluate();
    expect(report.scenarios).toEqual(['reports-cause', 'rubric-only']);
    expect(report.static).toEqual([
      expect.objectContaining({ id: 'keeps-evidence-rule', passed: true }),
    ]);
    expect(report.runs).toEqual([]);
  });

  it('grades recorded output files and separates manual scenarios', async () => {
    await writeSuite(suite());
    await writeResult(
      result({
        scenarios: [
          ...result().scenarios,
          {
            id: 'rubric-only',
            output: 'Summary.',
            manualScores: { Clarity: 2 },
          },
        ],
      }),
    );
    await writeFile(
      path.join(suiteDirectory, 'results', 'outputs', 'reports-cause.md'),
      'The Stale\ncache returned the old expiry.',
    );
    const [run] = (await evaluate()).runs;
    expect(run).toMatchObject({
      runId: 'run-1',
      condition: 'with-skill',
      passed: 1,
      failed: 0,
      manual: 1,
      notRun: [],
    });
    expect(run!.scenarios[1]).toMatchObject({
      status: 'manual',
      manualScores: { Clarity: 2 },
    });
    // Totals require every recorded scenario to report the metric.
    expect(run!.totals).toEqual({});
  });

  it('reports failures, unrun scenarios, and complete totals', async () => {
    await writeSuite(suite());
    await writeResult(
      result({
        condition: 'baseline',
        scenarios: [
          {
            id: 'reports-cause',
            output: 'I cannot determine the cause.',
            durationMs: 900,
            costUsd: 0.02,
          },
        ],
      }),
    );
    const [run] = (await evaluate()).runs;
    expect(run).toMatchObject({
      condition: 'baseline',
      passed: 0,
      failed: 1,
      notRun: ['rubric-only'],
      totals: { durationMs: 900, costUsd: 0.02 },
    });
    expect(
      run!.scenarios[0]!.checks.filter((check) => !check.passed),
    ).toHaveLength(2);
  });

  it('fails a static check when a protected phrase is removed', async () => {
    await writeFile(
      path.join(skill, 'SKILL.md'),
      skillText('sample-skill', '# Workflow\n\nDo the task.\n'),
    );
    await writeSuite(suite());
    expect((await evaluate()).static[0]!.passed).toBe(false);
  });

  it.each([
    [
      'a fixture outside the suite',
      { fixtures: ['../outside.txt'] },
      /escapes/,
    ],
    [
      'an absolute fixture path',
      { fixtures: ['/etc/passwd'] },
      /relative path/,
    ],
    [
      'a missing fixture',
      { fixtures: ['fixtures/absent.txt'] },
      /does not exist/,
    ],
    ['an unknown field', { command: 'rm -rf /' }, /command/],
    [
      'no assertions or rubric',
      { assertions: [] },
      /assertions, a manual rubric/,
    ],
  ])('rejects %s', async (_label, change, message) => {
    await writeSuite(suite({ scenarios: [{ ...scenario, ...change }] }));
    await expect(evaluate()).rejects.toThrow(message);
  });

  it.each([
    ['an unknown assertion type', { type: 'regex', value: '(a+)+$' }],
    ['an empty value', { type: 'contains', value: '  ' }],
  ])('rejects %s', async (_label, assertion) => {
    await writeSuite(
      suite({ scenarios: [{ ...scenario, assertions: [assertion] }] }),
    );
    await expect(evaluate()).rejects.toThrow(/assertions/);
  });

  it('rejects suites for another skill and duplicate scenario IDs', async () => {
    await writeSuite(suite({ skill: 'other-skill' }));
    await expect(evaluate()).rejects.toThrow(/expected "sample-skill"/);
    await writeSuite(suite({ scenarios: [scenario, scenario] }));
    await expect(evaluate()).rejects.toThrow(/duplicate scenario/);
  });

  it('rejects static checks that leave the skill directory', async () => {
    await writeSuite(
      suite({
        static: [
          {
            id: 'escape',
            file: '../../outside.md',
            assertion: { type: 'contains', value: 'x' },
          },
        ],
      }),
    );
    await expect(evaluate()).rejects.toThrow(/escapes/);
  });

  it.each([
    [
      'an output file outside the suite',
      result({
        scenarios: [{ id: 'reports-cause', outputFile: '../../../secret.txt' }],
      }),
      /escapes/,
    ],
    [
      'an unknown scenario',
      result({ scenarios: [{ id: 'not-defined', output: 'x' }] }),
      /unknown scenario/,
    ],
    [
      'a run ID that differs from the file name',
      result({ runId: 'run-2' }),
      /match the file name/,
    ],
    [
      'both inline and file output',
      result({
        scenarios: [{ id: 'reports-cause', output: 'x', outputFile: 'x.md' }],
      }),
      /exactly one/,
    ],
    [
      'a negative cost',
      result({
        scenarios: [{ id: 'reports-cause', output: 'x', costUsd: -1 }],
      }),
      /costUsd/,
    ],
    ['an invalid timestamp', result({ recordedAt: 'yesterday' }), /recordedAt/],
  ])('rejects a result with %s', async (_label, value, message) => {
    await writeSuite(suite());
    await writeResult(value);
    await expect(evaluate()).rejects.toThrow(message);
  });
});

describe('bundled evaluation suites', () => {
  it('target catalog skills, load cleanly, and pass static checks', async () => {
    const skills = await loadCatalog(catalog);
    const names = (await readdir(evals, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(names.length).toBeGreaterThanOrEqual(5);
    for (const name of names) {
      const skill = skills.find((item) => item.metadata.name === name);
      expect(skill, `evals/${name} has no catalog skill`).toBeDefined();
      const suiteDirectory = path.join(evals, name);
      const loaded = await loadEvaluationSuite(suiteDirectory, name);
      expect(loaded.static?.length, name).toBeGreaterThan(0);
      const report = await evaluateSkill({
        skill: name,
        skillDirectory: skill!.directory,
        suiteDirectory,
      });
      expect(
        report.static.filter((check) => !check.passed),
        name,
      ).toEqual([]);
    }
  });

  it('cover every meta skill and documentation-engineer', async () => {
    const names = await readdir(evals);
    for (const name of [
      'documentation-engineer',
      'skill-creator',
      'skill-evaluator',
      'skill-optimizer',
      'skill-reviewer',
    ])
      expect(names).toContain(name);
  });
});
