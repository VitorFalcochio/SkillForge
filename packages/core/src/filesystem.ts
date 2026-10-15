import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const LIMITS = {
  files: 1000,
  bytesPerFile: 2 * 1024 * 1024,
  totalBytes: 20 * 1024 * 1024,
  depth: 32,
} as const;

export function isWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

/** Apply portable filename rules, even when running on POSIX. */
export function assertPortablePath(value: string): void {
  if (
    /[<>:"|?*]/.test(value) ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    throw new Error(`Unsafe path characters: ${value}`);
  for (const component of value.replace(/\\/g, '/').split('/')) {
    if (component === '.' || component === '..' || component === '') continue;
    if (
      /[. ]$/.test(component) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(component)
    ) {
      throw new Error(`Filename is not portable to Windows: ${component}`);
    }
  }
}

export function resolveLocalPath(
  root: string,
  fromDirectory: string,
  reference: string,
): string {
  const portable = reference.replace(/\\/g, '/');
  if (
    path.posix.isAbsolute(portable) ||
    path.win32.isAbsolute(reference) ||
    /^[a-z]:/i.test(reference)
  ) {
    throw new Error(`Use a relative path inside the skill: ${reference}`);
  }
  assertPortablePath(portable);
  const target = path.resolve(fromDirectory, portable);
  if (!isWithin(root, target))
    throw new Error(`Path escapes the skill directory: ${reference}`);
  return target;
}

export async function exists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (isFsError(error, 'ENOENT')) return false;
    throw error;
  }
}

export function isFsError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

/** Check every existing component, including dangling links and Windows junctions. */
export async function assertNoSymlinks(target: string): Promise<void> {
  const absolute = path.resolve(target);
  const root = path.parse(absolute).root;
  let current = root;
  for (const component of absolute
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, component);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink())
        throw new Error(`Symlinks and junctions are not allowed: ${current}`);
    } catch (error) {
      if (isFsError(error, 'ENOENT')) return;
      throw error;
    }
  }
}

export interface SkillFile {
  relative: string;
  absolute: string;
  size: number;
}

export async function walkSkill(root: string): Promise<SkillFile[]> {
  await assertNoSymlinks(root);
  if (!(await lstat(root)).isDirectory())
    throw new Error(`Expected a skill directory: ${root}`);
  const files: SkillFile[] = [];
  const portableNames = new Set<string>();
  let bytes = 0;
  let entries = 0;
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > LIMITS.depth)
      throw new Error(
        `Directory nesting exceeds ${LIMITS.depth}: ${directory}`,
      );
    for (const entry of (await readdir(directory)).sort()) {
      if (++entries > LIMITS.files)
        throw new Error(`Skill exceeds ${LIMITS.files} filesystem entries.`);
      assertPortablePath(entry);
      const absolute = path.join(directory, entry);
      const relative = path.relative(root, absolute);
      const key = relative.toLowerCase();
      if (portableNames.has(key))
        throw new Error(`Case-insensitive filename collision: ${relative}`);
      portableNames.add(key);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink())
        throw new Error(`Symlinks and junctions are not allowed: ${absolute}`);
      if (stat.isDirectory()) await walk(absolute, depth + 1);
      else if (stat.isFile()) {
        bytes += stat.size;
        if (stat.size > LIMITS.bytesPerFile || bytes > LIMITS.totalBytes)
          throw new Error(
            `Skill exceeds file or total byte limits: ${relative}`,
          );
        files.push({ relative, absolute, size: stat.size });
      } else
        throw new Error(
          `Only regular files and directories are allowed: ${absolute}`,
        );
    }
  }
  await walk(root, 0);
  return files;
}

export async function readTextFile(target: string): Promise<string> {
  await assertNoSymlinks(target);
  const stat = await lstat(target);
  if (!stat.isFile() || stat.size > LIMITS.bytesPerFile)
    throw new Error(
      `Expected a regular file of at most ${LIMITS.bytesPerFile} bytes: ${target}`,
    );
  return readFile(target, 'utf8');
}
