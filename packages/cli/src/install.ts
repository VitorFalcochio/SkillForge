import { constants } from 'node:fs';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import {
  assertNoSymlinks,
  exists,
  installationPath,
  isFsError,
  isWithin,
  walkSkill,
} from '@agentskills/core';
import type { Agent, Scope } from '@agentskills/core';
import { validate } from '@agentskills/validator';
import type { Diagnostic } from '@agentskills/validator';

export interface InstallOptions {
  source: string;
  name: string;
  agent: Agent;
  scope: Scope;
  project: string;
  home: string;
  overwrite?: boolean;
  confirmOverwrite?: (target: string) => Promise<boolean>;
}

export interface InstallResult {
  target: string;
  replaced: boolean;
  diagnostics: Diagnostic[];
}

async function removeStaging(root: string, staging: string): Promise<void> {
  if (!isWithin(root, staging) || staging === root)
    throw new Error('Refusing unsafe staging cleanup.');
  await assertNoSymlinks(staging);
  await rm(staging, { recursive: true, force: true });
}

/** Install reviewed local content. No process execution or network operations occur here. */
export async function installSkill(
  options: InstallOptions,
): Promise<InstallResult> {
  const source = path.resolve(options.source);
  const sourceResult = await validate(source);
  if (!sourceResult.valid || sourceResult.skills !== 1)
    throw new Error(
      `Source skill failed validation: ${sourceResult.diagnostics.map((item) => item.message).join('; ')}`,
    );
  // Resolve the trusted project/home anchor once; reject links below it.
  const anchor = await realpath(
    options.scope === 'project' ? options.project : options.home,
  );
  if (!(await lstat(anchor)).isDirectory())
    throw new Error(`Installation base must be a directory: ${anchor}`);
  const { root, target } = installationPath({
    ...options,
    project: anchor,
    home: anchor,
  });
  if (path.basename(source) !== options.name)
    throw new Error('Source folder and requested skill name must match.');
  if (isWithin(source, target) || isWithin(target, source))
    throw new Error('Source and installation destination must not overlap.');
  await assertNoSymlinks(target);
  await mkdir(root, { recursive: true });
  await assertNoSymlinks(target);
  const lockPath = path.join(root, `.agentskills-${options.name}.lock`);
  const lock = await open(lockPath, 'wx').catch((error: unknown) => {
    if (isFsError(error, 'EEXIST')) {
      throw new Error(
        `EEXIST: another installation may be active; lock exists at ${lockPath}. Confirm no installer is running before removing a stale lock.`,
        { cause: error },
      );
    }
    throw error;
  });
  let staging: string | undefined;
  let preserveBackup = false;
  try {
    const replaced = await exists(target);
    if (replaced) {
      if (!(await lstat(target)).isDirectory())
        throw new Error(`Existing target is not a directory: ${target}`);
      // Reject links even inside a tree that would be replaced.
      await walkSkill(target);
      const confirmed =
        options.overwrite === true ||
        (await options.confirmOverwrite?.(target)) === true;
      if (!confirmed)
        throw new Error(
          `Skill already exists: ${target}. Confirm interactively or pass --force to replace it.`,
        );
    }
    staging = await mkdtemp(path.join(root, '.agentskills-stage-'));
    const stagedSkill = path.join(staging, options.name);
    await mkdir(stagedSkill);
    for (const file of await walkSkill(source)) {
      const destination = path.join(stagedSkill, file.relative);
      if (!isWithin(stagedSkill, destination))
        throw new Error('Copy destination escaped staging directory.');
      await mkdir(path.dirname(destination), { recursive: true });
      await assertNoSymlinks(file.absolute);
      await copyFile(file.absolute, destination, constants.COPYFILE_EXCL);
      // Copy content, never source execute/setuid permissions.
      await chmod(destination, 0o644);
    }
    const stagedResult = await validate(stagedSkill);
    if (!stagedResult.valid)
      throw new Error(
        `Staged skill failed validation: ${stagedResult.diagnostics.map((item) => item.message).join('; ')}`,
      );
    await assertNoSymlinks(target);
    if ((await exists(target)) !== replaced)
      throw new Error(
        'Destination changed during installation; retry after reviewing it.',
      );
    const backup = path.join(staging, 'previous');
    if (replaced) await rename(target, backup);
    try {
      await rename(stagedSkill, target);
    } catch (error) {
      if (replaced) {
        try {
          await rename(backup, target);
        } catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError(
            [error, restoreError],
            `Installation and rollback failed. Previous skill preserved at ${backup}.`,
            { cause: restoreError },
          );
        }
      }
      throw error;
    }
    return { target, replaced, diagnostics: sourceResult.diagnostics };
  } finally {
    try {
      if (staging && !preserveBackup) {
        await removeStaging(root, staging);
      }
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
}
