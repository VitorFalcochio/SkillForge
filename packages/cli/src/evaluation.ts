import type { EvaluationReport, RunOutcome } from '@agentskills/core';

function formatTotals(run: RunOutcome): string {
  const { durationMs, costUsd, inputTokens, outputTokens } = run.totals;
  return [
    durationMs === undefined
      ? 'duration not recorded'
      : `duration ${(durationMs / 1000).toFixed(1)} s`,
    costUsd === undefined ? 'cost not recorded' : `cost $${costUsd.toFixed(4)}`,
    inputTokens === undefined || outputTokens === undefined
      ? 'tokens not recorded'
      : `tokens ${inputTokens} in / ${outputTokens} out`,
  ].join(', ');
}

export function printEvaluation(report: EvaluationReport): void {
  console.log(
    `Evaluation suite for ${report.skill}: ${report.scenarios.length} scenario(s), ${report.static.length} static check(s)\nSource: ${report.suite}\n`,
  );
  console.log('Static checks (deterministic, no model involved):');
  if (!report.static.length) console.log('  none defined');
  for (const check of report.static)
    console.log(
      `  ${check.passed ? 'PASS' : 'FAIL'} ${check.id} (${check.file}): ${check.detail}`,
    );

  console.log(
    '\nRecorded runs (model-dependent output, graded deterministically):',
  );
  if (!report.runs.length)
    console.log(
      '  none recorded; scenarios are defined but no results exist, so no outcome is claimed.',
    );
  for (const run of report.runs) {
    console.log(
      `  ${run.runId} [${run.condition}] ${run.agent}${run.model ? ` / ${run.model}` : ''}, recorded ${run.recordedAt}`,
    );
    console.log(
      `    ${run.passed} passed, ${run.failed} failed, ${run.manual} manual, ${run.notRun.length} not run; ${formatTotals(run)}`,
    );
    for (const scenario of run.scenarios) {
      console.log(`    ${scenario.status.toUpperCase()} ${scenario.id}`);
      for (const check of scenario.checks.filter((item) => !item.passed))
        console.log(`      expected output that ${check.detail}`);
    }
    for (const id of run.notRun) console.log(`    NOT RUN ${id}`);
  }
}
