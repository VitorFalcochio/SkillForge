import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isWithin, resolveLocalPath } from '../packages/core/dist/index.js';

export async function temporaryDirectory(): Promise<string> {
  const base = await realpath(tmpdir());
  return mkdtemp(path.join(base, 'agentskills-test-'));
}

export async function cleanup(root: string): Promise<void> {
  const base = await realpath(tmpdir());
  if (
    !isWithin(base, root) ||
    !path.basename(root).startsWith('agentskills-test-')
  )
    throw new Error('Unsafe test cleanup target.');
  await rm(root, { recursive: true, force: true });
}

export function skillText(
  name = 'sample-skill',
  body = '# Workflow\n\nInspect the provided artifact and report reproducible evidence.\n',
): string {
  return `---\nname: ${name}\ndescription: Investigate a supplied artifact when the user requests an evidence-backed review.\n---\n${body}`;
}

export async function makeSkill(
  base: string,
  name = 'sample-skill',
  files: Record<string, string> = {},
): Promise<string> {
  const root = path.join(base, name);
  await mkdir(root, { recursive: true });
  const contents = { 'SKILL.md': skillText(name), ...files };
  for (const [relative, content] of Object.entries(contents)) {
    const target = resolveLocalPath(root, root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}
