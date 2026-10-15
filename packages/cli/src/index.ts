#!/usr/bin/env node
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { Command, Option } from 'commander';
import {
  agentSchema,
  errorMessage,
  evaluateSkill,
  loadCatalog,
  scopeSchema,
  skillNameSchema,
} from '@agentskills/core';
import { validate } from '@agentskills/validator';
import type { Diagnostic } from '@agentskills/validator';
import { printEvaluation } from './evaluation.js';
import { installSkill } from './install.js';

const defaultCatalog = fileURLToPath(
  new URL('../../../skills/', import.meta.url),
);
const defaultEvaluations = fileURLToPath(
  new URL('../../../evals/', import.meta.url),
);
const program = new Command();

function printDiagnostics(diagnostics: Diagnostic[]): void {
  for (const item of diagnostics) {
    const location = `${item.path}${item.line ? `:${item.line}` : ''}`;
    console.error(
      `${item.severity.toUpperCase()} ${item.code} ${location}: ${item.message}`,
    );
  }
}

async function findSkill(name: string) {
  skillNameSchema.parse(name);
  const catalog = await loadCatalog(
    path.resolve(program.opts<{ catalog: string }>().catalog),
  );
  const skill = catalog.find((item) => item.metadata.name === name);
  if (!skill)
    throw new Error(
      `Unknown skill "${name}". Run agentskills list to see the local catalog.`,
    );
  return skill;
}

async function confirmOverwrite(target: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const answer = await prompt.question(
      `Replace existing skill at ${target}? [y/N] `,
    );
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

program
  .name('agentskills')
  .description('Discover, validate, and install local Agent Skills.')
  .version('0.1.0')
  .option('--catalog <path>', 'local skill catalog directory', defaultCatalog)
  .showHelpAfterError();

program
  .command('list')
  .description('List skills in the local catalog')
  .action(async () => {
    const skills = await loadCatalog(
      path.resolve(program.opts<{ catalog: string }>().catalog),
    );
    for (const skill of skills)
      console.log(
        `${skill.metadata.name}\t${skill.category}\t${skill.metadata.description}`,
      );
  });

program
  .command('info <skill>')
  .description('Show metadata and full workflow instructions')
  .action(async (name: string) => {
    const skill = await findSkill(name);
    console.log(
      `${skill.metadata.name}\n${skill.metadata.description}\nCategory: ${skill.category}\nSource: ${skill.directory}\n\n${skill.body.trim()}`,
    );
  });

program
  .command('validate <path>')
  .description('Validate a skill directory or category tree')
  .option('--strict', 'treat warnings as failures')
  .option('--json', 'emit machine-readable results')
  .action(
    async (target: string, options: { strict?: boolean; json?: boolean }) => {
      const result = await validate(target);
      const failed =
        !result.valid ||
        (options.strict &&
          result.diagnostics.some((item) => item.severity === 'warning'));
      if (options.json) console.log(JSON.stringify(result, null, 2));
      else {
        printDiagnostics(result.diagnostics);
        console.log(
          `${failed ? 'FAIL' : 'PASS'}: ${result.skills} skill(s), ${result.diagnostics.filter((item) => item.severity === 'error').length} error(s), ${result.diagnostics.filter((item) => item.severity === 'warning').length} warning(s).`,
        );
      }
      if (failed) process.exitCode = 1;
    },
  );

program
  .command('install <skill>')
  .description('Copy a catalog skill into a local agent skills directory')
  .addOption(
    new Option('--agent <agent>', 'target agent')
      .choices(['claude', 'codex'])
      .makeOptionMandatory(),
  )
  .addOption(
    new Option('--scope <scope>', 'installation scope')
      .choices(['project', 'user'])
      .default('project'),
  )
  .option(
    '--project <path>',
    'existing project directory (project scope)',
    process.cwd(),
  )
  .option('--force', 'explicitly authorize replacing the existing skill')
  .action(
    async (
      name: string,
      options: {
        agent: string;
        scope: string;
        project: string;
        force?: boolean;
      },
    ) => {
      const skill = await findSkill(name);
      const result = await installSkill({
        source: skill.directory,
        name,
        agent: agentSchema.parse(options.agent),
        scope: scopeSchema.parse(options.scope),
        project: path.resolve(options.project),
        home: homedir(),
        overwrite: options.force === true,
        confirmOverwrite,
      });
      printDiagnostics(result.diagnostics);
      console.log(
        `${result.replaced ? 'Replaced' : 'Installed'} ${name} at ${result.target}`,
      );
    },
  );

program
  .command('eval <skill>')
  .description(
    'Run deterministic checks of an evaluation suite and grade recorded results',
  )
  .option(
    '--suite <path>',
    'evaluation suite directory (default: bundled evals/<skill>)',
  )
  .option('--json', 'emit machine-readable results')
  .action(async (name: string, options: { suite?: string; json?: boolean }) => {
    const skill = await findSkill(name);
    const report = await evaluateSkill({
      skill: name,
      skillDirectory: skill.directory,
      suiteDirectory: path.resolve(
        options.suite ?? path.join(defaultEvaluations, name),
      ),
    });
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printEvaluation(report);
    // Recorded model output informs; only deterministic skill checks gate the exit code.
    if (report.static.some((check) => !check.passed)) process.exitCode = 1;
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`ERROR: ${errorMessage(error)}`);
  process.exitCode = 1;
}
