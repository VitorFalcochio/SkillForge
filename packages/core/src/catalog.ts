import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  assertNoSymlinks,
  exists,
  LIMITS,
  readTextFile,
} from './filesystem.js';
import { parseSkill } from './metadata.js';
import type { SkillDocument } from './metadata.js';

const ignored = new Set(['node_modules', 'dist', 'coverage']);
const resources = new Set(['references', 'scripts', 'assets', 'agents']);

/** Discover category trees without following links; malformed leaves remain visible to validation. */
export async function discoverSkillDirectories(
  root: string,
): Promise<string[]> {
  root = path.resolve(root);
  await assertNoSymlinks(root);
  const found: string[] = [];
  let entries = 0;
  async function walk(directory: string, depth: number): Promise<void> {
    if (++entries > LIMITS.files || depth > LIMITS.depth)
      throw new Error(
        'Catalog exceeds discovery limits. Validate a smaller directory.',
      );
    if (!(await lstat(directory)).isDirectory())
      throw new Error(`Expected a directory: ${directory}`);
    if (await exists(path.join(directory, 'SKILL.md'))) {
      found.push(directory);
      return;
    }
    const children: string[] = [];
    let hasResources = false;
    for (const name of (await readdir(directory)).sort()) {
      if (name.startsWith('.') || ignored.has(name)) continue;
      const target = path.join(directory, name);
      const stat = await lstat(target);
      if (stat.isSymbolicLink())
        throw new Error(`Symlinks and junctions are not allowed: ${target}`);
      if (stat.isDirectory()) {
        children.push(target);
        if (resources.has(name)) hasResources = true;
      }
    }
    if (!children.length || hasResources) {
      found.push(directory);
      return;
    }
    for (const child of children) await walk(child, depth + 1);
  }
  await walk(root, 0);
  return found;
}

export interface CatalogSkill extends SkillDocument {
  directory: string;
  category: string;
}

export async function loadCatalog(root: string): Promise<CatalogSkill[]> {
  const skills: CatalogSkill[] = [];
  const names = new Set<string>();
  for (const directory of await discoverSkillDirectories(root)) {
    const document = parseSkill(
      await readTextFile(path.join(directory, 'SKILL.md')),
    );
    if (document.metadata.name !== path.basename(directory))
      throw new Error(`Skill name must match its folder: ${directory}`);
    if (names.has(document.metadata.name))
      throw new Error(`Duplicate skill identifier: ${document.metadata.name}`);
    names.add(document.metadata.name);
    skills.push({
      ...document,
      directory,
      category:
        path
          .relative(root, path.dirname(directory))
          .split(path.sep)
          .join('/') || '.',
    });
  }
  return skills.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
}
