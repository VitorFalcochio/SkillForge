import { homedir } from 'node:os';
import path from 'node:path';
import type { Command } from 'commander';
import { Option } from 'commander';
import {
  agentPlatforms,
  compatibility,
  loadAgentCatalog,
  platformSchema,
  renderAgent,
  scopeSchema,
  skillNameSchema,
} from '@agentskills/core';
import type { CompatibilityReport, Platform } from '@agentskills/core';
import { validateAgents } from '@agentskills/validator';
import type { Diagnostic } from '@agentskills/validator';
import { installAgent } from './agent-install.js';

interface AgentCommandContext {
  agentCatalog: () => string;
  skillCatalog: () => string;
  printDiagnostics: (diagnostics: Diagnostic[]) => void;
  confirmOverwrite: (target: string) => Promise<boolean>;
}

function printCompatibility(report: CompatibilityReport): void {
  console.log(`${agentPlatforms[report.platform].label}:`);
  console.log(`  Tools: ${report.grantedTools.join(', ')}`);
  console.log(`  Related skills: ${report.skills}`);
  for (const item of report.restrictions)
    console.log(
      `  Not allowed: ${item.category}${item.critical ? ' (critical)' : ''}, ${item.enforcement}`,
    );
  for (const note of report.notes) console.log(`  Note: ${note}`);
}

export function registerAgentCommands(
  program: Command,
  context: AgentCommandContext,
): void {
  const agents = program
    .command('agents')
    .description('Discover, validate, and install specialized agents');

  async function findAgent(id: string) {
    skillNameSchema.parse(id);
    const catalog = await loadAgentCatalog(
      path.resolve(context.agentCatalog()),
    );
    const agent = catalog.find((item) => item.manifest.id === id);
    if (!agent)
      throw new Error(
        `Unknown agent "${id}". Run agentskills agents list to see the local catalog.`,
      );
    return agent;
  }

  agents
    .command('list')
    .description('List agents in the local agent catalog')
    .action(async () => {
      for (const { manifest } of await loadAgentCatalog(
        path.resolve(context.agentCatalog()),
      ))
        console.log(
          `${manifest.id}\t${Object.keys(manifest.platforms).join(',')}\t${manifest.description}`,
        );
    });

  agents
    .command('info <agent>')
    .description('Show an agent definition and its platform compatibility')
    .addOption(
      new Option(
        '--platform <platform>',
        'print the generated configuration for one platform',
      ).choices(platformSchema.options),
    )
    .action(async (id: string, options: { platform?: string }) => {
      const { manifest, directory } = await findAgent(id);
      if (options.platform) {
        console.log(
          renderAgent(manifest, platformSchema.parse(options.platform)).content,
        );
        return;
      }
      const section = (title: string, items: readonly string[]) =>
        console.log(
          `\n${title}:\n${items.map((item) => `  - ${item}`).join('\n')}`,
        );
      console.log(
        `${manifest.id} (${manifest.name})\n${manifest.description}\nSource: ${directory}`,
      );
      section('Responsibilities', manifest.responsibilities);
      section('Activation', manifest.activation);
      section('Related skills', manifest.skills ?? ['none']);
      section('Required capabilities', manifest.capabilities);
      section('Allowed tool categories', manifest.tools);
      section('Critical restrictions', manifest.restrictions ?? ['none']);
      section('Constraints', manifest.constraints);
      section('Expected outputs', manifest.outputs);
      section('Verification', manifest.verification);
      console.log('\nPlatform compatibility:');
      for (const platform of Object.keys(manifest.platforms))
        printCompatibility(
          compatibility(manifest, platformSchema.parse(platform)),
        );
    });

  agents
    .command('validate <path>')
    .description('Validate an agent directory or a directory of agents')
    .option('--strict', 'treat warnings as failures')
    .option('--json', 'emit machine-readable results')
    .action(
      async (target: string, options: { strict?: boolean; json?: boolean }) => {
        const result = await validateAgents(target, {
          skillCatalog: context.skillCatalog(),
        });
        const failed =
          !result.valid ||
          (options.strict &&
            result.diagnostics.some((item) => item.severity === 'warning'));
        if (options.json) console.log(JSON.stringify(result, null, 2));
        else {
          context.printDiagnostics(result.diagnostics);
          console.log(
            `${failed ? 'FAIL' : 'PASS'}: ${result.agents} agent(s), ${result.diagnostics.filter((item) => item.severity === 'error').length} error(s), ${result.diagnostics.filter((item) => item.severity === 'warning').length} warning(s).`,
          );
        }
        if (failed) process.exitCode = 1;
      },
    );

  agents
    .command('install <agent>')
    .description('Generate and install an agent for one platform')
    .addOption(
      new Option('--platform <platform>', 'target platform')
        .choices(platformSchema.options)
        .makeOptionMandatory(),
    )
    .addOption(
      new Option('--scope <scope>', 'installation scope')
        .choices(scopeSchema.options)
        .default('project'),
    )
    .option(
      '--project <path>',
      'existing project directory (project scope)',
      process.cwd(),
    )
    .option(
      '--with-skills',
      'also install related skills that are missing (never replaces existing skills)',
    )
    .option('--force', 'explicitly authorize replacing the existing agent file')
    .action(
      async (
        id: string,
        options: {
          platform: string;
          scope: string;
          project: string;
          withSkills?: boolean;
          force?: boolean;
        },
      ) => {
        const agent = await findAgent(id);
        const platform: Platform = platformSchema.parse(options.platform);
        const result = await installAgent({
          agent,
          platform,
          scope: scopeSchema.parse(options.scope),
          project: path.resolve(options.project),
          home: homedir(),
          skillCatalog: context.skillCatalog(),
          withSkills: options.withSkills === true,
          overwrite: options.force === true,
          confirmOverwrite: context.confirmOverwrite,
        });
        console.log(
          `${result.replaced ? 'Replaced' : 'Installed'} ${id} for ${agentPlatforms[platform].label} at ${result.target}`,
        );
        for (const skill of result.skills)
          console.log(
            `Related skill ${skill.name}: ${skill.status}${skill.location ? ` (${skill.location})` : ''}`,
          );
        if (result.skills.some((skill) => skill.status === 'missing'))
          console.error(
            'WARNING: some related skills are not installed. Install them, or rerun with --with-skills.',
          );
        for (const item of result.compatibility.restrictions.filter(
          (restriction) =>
            restriction.critical && restriction.enforcement !== 'enforced',
        ))
          console.error(
            `WARNING: critical restriction "${item.category}" is ${item.enforcement} on ${agentPlatforms[platform].label}; the generated instructions forbid it, but the platform does not fully prevent it.`,
          );
        for (const note of result.compatibility.notes)
          console.log(`Note: ${note}`);
      },
    );
}
