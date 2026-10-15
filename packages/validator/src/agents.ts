import path from 'node:path';
import {
  AGENT_MANIFEST,
  AgentParseError,
  discoverAgentDirectories,
  errorMessage,
  exists,
  loadCatalog,
  parseAgentManifest,
  platformSchema,
  readTextFile,
  restrictionEnforcement,
  walkSkill,
} from '@agentskills/core';
import type { AgentManifest } from '@agentskills/core';
import type { Diagnostic } from './index.js';

export interface AgentValidationResult {
  valid: boolean;
  agents: number;
  diagnostics: Diagnostic[];
}

function duplicates(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function checkManifest(
  manifest: AgentManifest,
  skillNames: Set<string> | undefined,
  report: (code: string, message: string) => void,
): void {
  for (const [field, values] of [
    ['capabilities', manifest.capabilities],
    ['tools', manifest.tools],
    ['restrictions', manifest.restrictions ?? []],
    ['skills', manifest.skills ?? []],
  ] as const)
    for (const value of new Set(duplicates(values)))
      report('DUPLICATE_ENTRY', `${field} lists "${value}" more than once.`);

  for (const capability of manifest.capabilities)
    if (!manifest.tools.includes(capability))
      report(
        'INVALID_TOOL',
        `Required capability "${capability}" is not granted in tools.`,
      );
  for (const restriction of manifest.restrictions ?? [])
    if (manifest.tools.includes(restriction))
      report(
        'INVALID_TOOL',
        `"${restriction}" cannot be both granted in tools and listed in restrictions.`,
      );

  if (skillNames)
    for (const skill of manifest.skills ?? [])
      if (!skillNames.has(skill))
        report(
          'MISSING_SKILL',
          `Related skill "${skill}" is not in the skill catalog.`,
        );

  const platforms = Object.entries(manifest.platforms);
  if (!platforms.length)
    report('NO_PLATFORM', 'Declare at least one target platform.');
  for (const [name, settings] of platforms) {
    const platform = platformSchema.safeParse(name);
    if (!platform.success) {
      report(
        'UNSUPPORTED_PLATFORM',
        `Platform "${name}" has no adapter. Supported: ${platformSchema.options.join(', ')}.`,
      );
      continue;
    }
    const acknowledged = settings.unenforced ?? [];
    for (const value of new Set(duplicates(acknowledged)))
      report(
        'DUPLICATE_ENTRY',
        `platforms.${name}.unenforced lists "${value}" more than once.`,
      );
    const needed = (manifest.restrictions ?? []).filter(
      (category) =>
        restrictionEnforcement(platform.data, manifest.tools, category) !==
        'enforced',
    );
    for (const category of needed)
      if (!acknowledged.includes(category))
        report(
          'UNENFORCED_RESTRICTION',
          `Critical restriction "${category}" is ${restrictionEnforcement(platform.data, manifest.tools, category)} on ${name}. Acknowledge it in platforms.${name}.unenforced or remove ${name} as a target.`,
        );
    for (const category of acknowledged)
      if (!needed.includes(category))
        report(
          'STALE_ACKNOWLEDGEMENT',
          `platforms.${name}.unenforced lists "${category}", which is not an unenforceable critical restriction on ${name}.`,
        );
  }
}

/**
 * Validate one agent directory or a directory of agents. Manifests are parsed
 * as data only; instructions are never executed or interpreted.
 */
export async function validateAgents(
  target: string,
  options: { skillCatalog?: string } = {},
): Promise<AgentValidationResult> {
  const diagnostics: Diagnostic[] = [];
  let skillNames: Set<string> | undefined;
  if (options.skillCatalog) {
    try {
      skillNames = new Set(
        (await loadCatalog(path.resolve(options.skillCatalog))).map(
          (skill) => skill.metadata.name,
        ),
      );
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        code: 'SKILL_CATALOG',
        path: path.resolve(options.skillCatalog),
        message: `Cannot load the skill catalog to resolve related skills: ${errorMessage(error)}`,
      });
    }
  }

  let directories: string[];
  try {
    directories = await discoverAgentDirectories(path.resolve(target));
  } catch (error) {
    return {
      valid: false,
      agents: 0,
      diagnostics: [
        ...diagnostics,
        {
          severity: 'error',
          code: 'DISCOVERY',
          path: path.resolve(target),
          message: errorMessage(error),
        },
      ],
    };
  }

  if (!directories.length)
    diagnostics.push({
      severity: 'error',
      code: 'NO_AGENTS',
      path: path.resolve(target),
      message: `No agent directories found. Validate a directory containing ${AGENT_MANIFEST} or agent folders.`,
    });
  const ids = new Map<string, string>();
  let agents = 0;
  for (const directory of directories) {
    const entry = path.join(directory, AGENT_MANIFEST);
    const report = (
      code: string,
      message: string,
      severity: Diagnostic['severity'] = 'error',
    ) => diagnostics.push({ severity, code, path: entry, message });
    try {
      const files = await walkSkill(directory);
      if (
        !(await exists(entry)) ||
        !files.some((f) => f.relative === AGENT_MANIFEST)
      ) {
        report(
          'MISSING_MANIFEST',
          `Add a regular file named exactly ${AGENT_MANIFEST} to this agent directory.`,
        );
        continue;
      }
      for (const file of files)
        if (file.relative !== AGENT_MANIFEST)
          report(
            'UNEXPECTED_FILE',
            `Agent directories contain only ${AGENT_MANIFEST}; ${file.relative} is not used by any adapter.`,
            'warning',
          );
      const manifest = parseAgentManifest(await readTextFile(entry));
      agents++;
      if (manifest.id !== path.basename(directory))
        report(
          'ID_MISMATCH',
          `Manifest id "${manifest.id}" must match folder "${path.basename(directory)}".`,
        );
      const previous = ids.get(manifest.id);
      if (previous)
        report(
          'DUPLICATE_AGENT',
          `Duplicate agent identifier "${manifest.id}"; also defined in ${previous}.`,
        );
      ids.set(manifest.id, directory);
      checkManifest(manifest, skillNames, report);
    } catch (error) {
      report(
        error instanceof AgentParseError ? error.code : 'FILESYSTEM',
        errorMessage(error),
      );
    }
  }
  return {
    valid: !diagnostics.some((item) => item.severity === 'error'),
    agents,
    diagnostics,
  };
}
