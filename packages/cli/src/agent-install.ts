import { randomBytes } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import {
  adapters,
  agentInstallationPath,
  agentPlatforms,
  assertNoSymlinks,
  declaredAgentName,
  exists,
  isFsError,
  loadCatalog,
  readTextFile,
  renderAgent,
} from '@agentskills/core';
import type {
  CatalogAgent,
  CompatibilityReport,
  Platform,
  Scope,
} from '@agentskills/core';
import { validateAgents } from '@agentskills/validator';
import { installSkill } from './install.js';

export interface AgentInstallOptions {
  agent: CatalogAgent;
  platform: Platform;
  scope: Scope;
  project: string;
  home: string;
  skillCatalog: string;
  withSkills?: boolean;
  overwrite?: boolean;
  confirmOverwrite?: (target: string) => Promise<boolean>;
}

export interface SkillStatus {
  name: string;
  status: 'present' | 'installed' | 'missing';
  location?: string;
}

export interface AgentInstallResult {
  target: string;
  replaced: boolean;
  compatibility: CompatibilityReport;
  skills: SkillStatus[];
}

async function declaredName(
  file: string,
  platform: Platform,
): Promise<string | undefined> {
  try {
    return declaredAgentName(await readTextFile(file), platform);
  } catch {
    // Unreadable or oversized files cannot declare an identity we can verify.
    return undefined;
  }
}

async function assertNoNameConflict(
  root: string,
  target: string,
  platform: Platform,
  id: string,
): Promise<void> {
  const extension = agentPlatforms[platform].extension;
  for (const name of (await readdir(root)).slice(0, 1000)) {
    const file = path.join(root, name);
    if (file === target || !name.endsWith(extension)) continue;
    if (!(await lstat(file)).isFile()) continue;
    if ((await declaredName(file, platform)) === id)
      throw new Error(
        `${file} already declares an agent named "${id}". ${agentPlatforms[platform].label} would load only one of them; remove or rename it first.`,
      );
  }
}

async function writeExclusive(file: string, content: string): Promise<void> {
  const handle = await open(file, 'wx', 0o644);
  try {
    await handle.writeFile(content, 'utf8');
  } finally {
    await handle.close();
  }
}

/**
 * Generate and install one agent file. Related skills are installed only with
 * explicit opt-in and never replace an existing skill. Nothing is executed.
 */
export async function installAgent(
  options: AgentInstallOptions,
): Promise<AgentInstallResult> {
  const { manifest, directory } = options.agent;
  const validation = await validateAgents(directory, {
    skillCatalog: options.skillCatalog,
  });
  if (!validation.valid || validation.agents !== 1)
    throw new Error(
      `Agent failed validation: ${validation.diagnostics.map((item) => `${item.code} ${item.message}`).join('; ')}`,
    );
  if (!(options.platform in manifest.platforms))
    throw new Error(
      `Agent "${manifest.id}" does not declare support for ${options.platform}. Declared: ${Object.keys(manifest.platforms).join(', ')}.`,
    );

  // Resolve the trusted project/home anchor once; reject links below it.
  const anchor = await realpath(
    options.scope === 'project' ? options.project : options.home,
  );
  if (!(await lstat(anchor)).isDirectory())
    throw new Error(`Installation base must be a directory: ${anchor}`);
  const home = await realpath(options.home).catch(() => undefined);
  const { root, target } = agentInstallationPath({
    platform: options.platform,
    scope: options.scope,
    id: manifest.id,
    project: anchor,
    home: anchor,
  });
  await assertNoSymlinks(target);
  await mkdir(root, { recursive: true });
  await assertNoSymlinks(target);
  await assertNoNameConflict(root, target, options.platform, manifest.id);

  const replaced = await exists(target);
  if (replaced) {
    if (!(await lstat(target)).isFile())
      throw new Error(`Existing agent target is not a regular file: ${target}`);
    const confirmed =
      options.overwrite === true ||
      (await options.confirmOverwrite?.(target)) === true;
    if (!confirmed)
      throw new Error(
        `Agent already exists: ${target}. Confirm interactively or pass --force to replace it.`,
      );
  }

  const skills: SkillStatus[] = [];
  const catalog = manifest.skills?.length
    ? await loadCatalog(path.resolve(options.skillCatalog))
    : [];
  for (const name of manifest.skills ?? []) {
    const segments = adapters[options.platform].segments;
    const candidates = [anchor, ...(home && home !== anchor ? [home] : [])].map(
      (base) => path.join(base, ...segments, name),
    );
    let location: string | undefined;
    for (const candidate of candidates)
      if (await exists(candidate)) {
        location = candidate;
        break;
      }
    if (location) skills.push({ name, status: 'present', location });
    else if (options.withSkills) {
      const source = catalog.find((skill) => skill.metadata.name === name);
      if (!source)
        throw new Error(`Related skill not found in catalog: ${name}`);
      const installed = await installSkill({
        source: source.directory,
        name,
        agent: options.platform,
        scope: options.scope,
        project: anchor,
        home: anchor,
        overwrite: false,
      });
      skills.push({ name, status: 'installed', location: installed.target });
    } else skills.push({ name, status: 'missing' });
  }

  const rendered = renderAgent(manifest, options.platform);
  await assertNoSymlinks(target);
  if ((await exists(target)) !== replaced)
    throw new Error(
      'Destination changed during installation; retry after reviewing it.',
    );
  if (!replaced) {
    try {
      await writeExclusive(target, rendered.content);
    } catch (error) {
      if (isFsError(error, 'EEXIST'))
        throw new Error(`Agent appeared during installation: ${target}`, {
          cause: error,
        });
      throw error;
    }
  } else {
    const temporary = path.join(
      root,
      `.agentskills-agent-${manifest.id}-${randomBytes(6).toString('hex')}.tmp`,
    );
    await writeExclusive(temporary, rendered.content);
    try {
      await rename(temporary, target);
    } catch (error) {
      await unlink(temporary).catch(() => undefined);
      throw error;
    }
  }
  return { target, replaced, compatibility: rendered.compatibility, skills };
}
