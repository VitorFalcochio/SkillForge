import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  assertNoSymlinks,
  exists,
  readTextFile,
  resolveLocalPath,
  walkSkill,
} from './filesystem.js';
import { skillNameSchema } from './metadata.js';

/**
 * Evaluation suites describe scenarios for a skill and grade recorded agent
 * output with deterministic text assertions. Nothing here runs a model, a shell,
 * or any fixture content; producing the output is a separate, recorded step.
 */
export const EVALUATION_LIMITS = {
  scenarios: 100,
  assertions: 50,
  resultFiles: 100,
  textLength: 20000,
  /** Matches the per-file read limit applied to recorded output files. */
  outputLength: 2 * 1024 * 1024,
} as const;

const identifierSchema = z
  .string()
  .max(64)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use lowercase ASCII letters, digits, and single hyphens.',
  );
const shortText = z.string().trim().min(1).max(EVALUATION_LIMITS.textLength);
const needle = z.string().trim().min(1).max(500);

// Plain substring checks only: contributed suites never supply regular expressions.
export const assertionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('contains'),
    value: needle,
    ignoreCase: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('not-contains'),
    value: needle,
    ignoreCase: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal('contains-any'),
    values: z.array(needle).min(1).max(20),
    ignoreCase: z.boolean().optional(),
  }),
]);
export type Assertion = z.infer<typeof assertionSchema>;

const staticCheckSchema = z.strictObject({
  id: identifierSchema,
  file: z.string().min(1).max(512),
  assertion: assertionSchema,
});

const scenarioSchema = z
  .strictObject({
    id: identifierSchema,
    description: shortText,
    prompt: shortText,
    fixtures: z.array(z.string().min(1).max(512)).max(50).optional(),
    expected: z.array(shortText).min(1).max(20),
    assertions: z
      .array(assertionSchema)
      .max(EVALUATION_LIMITS.assertions)
      .optional(),
    rubric: z
      .array(z.strictObject({ criterion: shortText, scale: shortText }))
      .max(20)
      .optional(),
  })
  .refine(
    (scenario) => scenario.assertions?.length || scenario.rubric?.length,
    'A scenario needs deterministic assertions, a manual rubric, or both.',
  );

export const evaluationSuiteSchema = z.strictObject({
  version: z.literal(1),
  skill: skillNameSchema,
  static: z
    .array(staticCheckSchema)
    .max(EVALUATION_LIMITS.assertions)
    .optional(),
  scenarios: z.array(scenarioSchema).min(1).max(EVALUATION_LIMITS.scenarios),
});
export type EvaluationSuite = z.infer<typeof evaluationSuiteSchema>;

const measure = z.number().finite().nonnegative();
const recordedScenarioSchema = z
  .strictObject({
    id: identifierSchema,
    output: z.string().max(EVALUATION_LIMITS.outputLength).optional(),
    outputFile: z.string().min(1).max(512).optional(),
    durationMs: measure.optional(),
    costUsd: measure.optional(),
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    manualScores: z.record(z.string().min(1), measure).optional(),
    notes: z.string().max(EVALUATION_LIMITS.textLength).optional(),
  })
  .refine(
    (item) => (item.output === undefined) !== (item.outputFile === undefined),
    'Provide exactly one of output or outputFile.',
  );

export const evaluationResultSchema = z.strictObject({
  version: z.literal(1),
  skill: skillNameSchema,
  runId: identifierSchema,
  recordedAt: z.iso.datetime({ offset: true }),
  condition: z.enum(['with-skill', 'baseline']),
  agent: z.string().trim().min(1).max(200),
  model: z.string().trim().min(1).max(200).optional(),
  skillRevision: z.string().trim().min(1).max(200).optional(),
  scenarios: z
    .array(recordedScenarioSchema)
    .min(1)
    .max(EVALUATION_LIMITS.scenarios),
});
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

export interface CheckOutcome {
  passed: boolean;
  detail: string;
}

export interface StaticOutcome extends CheckOutcome {
  id: string;
  file: string;
}

export interface ScenarioOutcome {
  id: string;
  /** `manual` when the scenario has only a rubric, so code cannot grade it. */
  status: 'pass' | 'fail' | 'manual';
  checks: CheckOutcome[];
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  manualScores?: Record<string, number>;
}

export interface Totals {
  durationMs?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RunOutcome {
  runId: string;
  condition: EvaluationResult['condition'];
  agent: string;
  model?: string;
  skillRevision?: string;
  recordedAt: string;
  scenarios: ScenarioOutcome[];
  notRun: string[];
  passed: number;
  failed: number;
  manual: number;
  /** Present only for metrics recorded for every scenario in the run. */
  totals: Totals;
}

export interface EvaluationReport {
  skill: string;
  suite: string;
  scenarios: string[];
  static: StaticOutcome[];
  runs: RunOutcome[];
}

const normalize = (text: string, ignoreCase: boolean) => {
  const collapsed = text.replace(/\s+/g, ' ');
  return ignoreCase ? collapsed.toLowerCase() : collapsed;
};

/** Grade text with one assertion. Whitespace runs compare as single spaces. */
export function checkText(text: string, assertion: Assertion): CheckOutcome {
  const ignoreCase = assertion.ignoreCase ?? true;
  const haystack = normalize(text, ignoreCase);
  const has = (value: string) =>
    haystack.includes(normalize(value, ignoreCase));
  switch (assertion.type) {
    case 'contains':
      return {
        passed: has(assertion.value),
        detail: `contains "${assertion.value}"`,
      };
    case 'not-contains':
      return {
        passed: !has(assertion.value),
        detail: `does not contain "${assertion.value}"`,
      };
    case 'contains-any':
      return {
        passed: assertion.values.some(has),
        detail: `contains any of ${assertion.values.map((value) => `"${value}"`).join(', ')}`,
      };
  }
}

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = JSON.parse(await readTextFile(file));
  } catch (error) {
    throw new Error(
      `Cannot read JSON ${file}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `${file}: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')}`,
    );
  return parsed.data;
}

function assertUnique(ids: string[], label: string, source: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${source}: duplicate ${label} "${id}".`);
    seen.add(id);
  }
}

/** Load `suite.json` and confirm every fixture stays inside the suite directory. */
export async function loadEvaluationSuite(
  directory: string,
  skill: string,
): Promise<EvaluationSuite> {
  directory = path.resolve(directory);
  await assertNoSymlinks(directory);
  const file = path.join(directory, 'suite.json');
  if (!(await exists(file)))
    throw new Error(`No evaluation suite found at ${file}.`);
  const suite = await readJson(file, evaluationSuiteSchema);
  if (suite.skill !== skill)
    throw new Error(
      `${file}: suite targets "${suite.skill}", expected "${skill}".`,
    );
  assertUnique(
    suite.scenarios.map((item) => item.id),
    'scenario',
    file,
  );
  assertUnique(
    (suite.static ?? []).map((item) => item.id),
    'static check',
    file,
  );
  for (const scenario of suite.scenarios) {
    for (const fixture of scenario.fixtures ?? []) {
      const target = resolveLocalPath(directory, directory, fixture);
      if (!(await exists(target)))
        throw new Error(
          `${file}: fixture for "${scenario.id}" does not exist: ${fixture}`,
        );
      const stat = await lstat(target);
      // Walking applies the same link, size, and portable-name limits as skills.
      if (stat.isDirectory()) await walkSkill(target);
      else if (!stat.isFile())
        throw new Error(`${file}: fixture is not a regular file: ${fixture}`);
    }
  }
  return suite;
}

async function loadResults(
  directory: string,
  suite: EvaluationSuite,
): Promise<{ result: EvaluationResult; outputs: Map<string, string> }[]> {
  const resultsDirectory = path.join(directory, 'results');
  if (!(await exists(resultsDirectory))) return [];
  await assertNoSymlinks(resultsDirectory);
  const names = (await readdir(resultsDirectory))
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (names.length > EVALUATION_LIMITS.resultFiles)
    throw new Error(
      `More than ${EVALUATION_LIMITS.resultFiles} result files in ${resultsDirectory}.`,
    );
  const known = new Set(suite.scenarios.map((item) => item.id));
  const loaded = [];
  for (const name of names) {
    const file = path.join(resultsDirectory, name);
    const result = await readJson(file, evaluationResultSchema);
    if (result.skill !== suite.skill)
      throw new Error(`${file}: result targets "${result.skill}".`);
    if (`${result.runId}.json` !== name)
      throw new Error(`${file}: runId must match the file name.`);
    assertUnique(
      result.scenarios.map((item) => item.id),
      'recorded scenario',
      file,
    );
    const outputs = new Map<string, string>();
    for (const item of result.scenarios) {
      if (!known.has(item.id))
        throw new Error(`${file}: unknown scenario "${item.id}".`);
      outputs.set(
        item.id,
        item.outputFile === undefined
          ? (item.output ?? '')
          : await readTextFile(
              resolveLocalPath(directory, resultsDirectory, item.outputFile),
            ),
      );
    }
    loaded.push({ result, outputs });
  }
  return loaded;
}

function sum(
  scenarios: ScenarioOutcome[],
  key: keyof Totals,
): number | undefined {
  if (!scenarios.length) return undefined;
  let total = 0;
  for (const scenario of scenarios) {
    const value = scenario[key];
    if (value === undefined) return undefined;
    total += value;
  }
  return total;
}

/** Run static checks against the skill and grade every recorded result in the suite. */
export async function evaluateSkill(options: {
  skill: string;
  skillDirectory: string;
  suiteDirectory: string;
}): Promise<EvaluationReport> {
  const skill = skillNameSchema.parse(options.skill);
  const suiteDirectory = path.resolve(options.suiteDirectory);
  const skillDirectory = path.resolve(options.skillDirectory);
  const suite = await loadEvaluationSuite(suiteDirectory, skill);

  const staticOutcomes: StaticOutcome[] = [];
  for (const check of suite.static ?? []) {
    const text = await readTextFile(
      resolveLocalPath(skillDirectory, skillDirectory, check.file),
    );
    staticOutcomes.push({
      id: check.id,
      file: check.file,
      ...checkText(text, check.assertion),
    });
  }

  const runs: RunOutcome[] = [];
  for (const { result, outputs } of await loadResults(suiteDirectory, suite)) {
    const scenarios: ScenarioOutcome[] = [];
    for (const recorded of result.scenarios) {
      const scenario = suite.scenarios.find((item) => item.id === recorded.id)!;
      const output = outputs.get(recorded.id) ?? '';
      const checks = (scenario.assertions ?? []).map((assertion) =>
        checkText(output, assertion),
      );
      const outcome: ScenarioOutcome = {
        id: recorded.id,
        status: !checks.length
          ? 'manual'
          : checks.every((check) => check.passed)
            ? 'pass'
            : 'fail',
        checks,
      };
      for (const key of [
        'durationMs',
        'costUsd',
        'inputTokens',
        'outputTokens',
      ] as const) {
        const value = recorded[key];
        if (value !== undefined) outcome[key] = value;
      }
      if (recorded.manualScores) outcome.manualScores = recorded.manualScores;
      scenarios.push(outcome);
    }
    const recordedIds = new Set(scenarios.map((item) => item.id));
    const totals: Totals = {};
    for (const key of [
      'durationMs',
      'costUsd',
      'inputTokens',
      'outputTokens',
    ] as const) {
      const value = sum(scenarios, key);
      if (value !== undefined) totals[key] = value;
    }
    const run: RunOutcome = {
      runId: result.runId,
      condition: result.condition,
      agent: result.agent,
      recordedAt: result.recordedAt,
      scenarios,
      notRun: suite.scenarios
        .map((item) => item.id)
        .filter((id) => !recordedIds.has(id)),
      passed: scenarios.filter((item) => item.status === 'pass').length,
      failed: scenarios.filter((item) => item.status === 'fail').length,
      manual: scenarios.filter((item) => item.status === 'manual').length,
      totals,
    };
    if (result.model) run.model = result.model;
    if (result.skillRevision) run.skillRevision = result.skillRevision;
    runs.push(run);
  }

  return {
    skill,
    suite: suiteDirectory,
    scenarios: suite.scenarios.map((item) => item.id),
    static: staticOutcomes,
    runs,
  };
}
