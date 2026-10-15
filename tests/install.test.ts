import {
  access,
  mkdir,
  open,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import type * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exists } from '../packages/core/dist/index.js';
import { installSkill } from '../packages/cli/src/install.js';
import { validate } from '../packages/validator/dist/index.js';
import {
  cleanup,
  makeSkill,
  skillText,
  temporaryDirectory,
} from './helpers.js';

const fault = vi.hoisted(() => ({ publish: false, rollback: false }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fsPromises>();
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      if (
        fault.publish &&
        from.includes('.agentskills-stage-') &&
        path.basename(from) === 'sample-skill'
      ) {
        fault.publish = false;
        throw new Error('Injected publish failure');
      }
      if (fault.rollback && path.basename(from) === 'previous') {
        fault.rollback = false;
        throw new Error('Injected rollback failure');
      }
      return actual.rename(from, to);
    },
  };
});

describe('isolated local installation', () => {
  let root: string;
  let source: string;
  let project: string;
  let home: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
    source = await makeSkill(path.join(root, 'catalog'));
    project = path.join(root, 'project with spaces');
    home = path.join(root, 'home');
    await mkdir(project);
    await mkdir(home);
    fault.publish = false;
    fault.rollback = false;
  });
  afterEach(async () => cleanup(root));
  const options = () => ({
    source,
    name: 'sample-skill',
    agent: 'codex' as const,
    scope: 'project' as const,
    project,
    home,
  });

  it.each([
    ['claude', 'project', '.claude'],
    ['codex', 'project', '.agents'],
    ['claude', 'user', '.claude'],
    ['codex', 'user', '.agents'],
  ] as const)('installs for %s at %s scope', async (agent, scope, folder) => {
    const result = await installSkill({ ...options(), agent, scope });
    expect(result.target).toBe(
      path.join(
        scope === 'project' ? project : home,
        folder,
        'skills',
        'sample-skill',
      ),
    );
    expect(await readFile(path.join(result.target, 'SKILL.md'), 'utf8')).toBe(
      skillText(),
    );
    expect((await validate(result.target)).valid).toBe(true);
    expect(await readdir(path.dirname(result.target))).toEqual([
      'sample-skill',
    ]);
  });
  it('copies resources without executing scripts', async () => {
    const marker = path.join(root, 'executed');
    await mkdir(path.join(source, 'scripts'));
    await writeFile(
      path.join(source, 'scripts', 'untrusted.js'),
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'bad');`,
    );
    const result = await installSkill(options());
    await expect(access(marker)).rejects.toThrow();
    expect(
      await readFile(
        path.join(result.target, 'scripts', 'untrusted.js'),
        'utf8',
      ),
    ).toContain('writeFileSync');
    expect(result.diagnostics.map((item) => item.code)).toContain(
      'UNTRUSTED_SCRIPTS',
    );
  });
  it('refuses overwrite by default and preserves existing content', async () => {
    const initial = await installSkill(options());
    await writeFile(path.join(initial.target, 'user-note.txt'), 'preserve me');
    await expect(installSkill(options())).rejects.toThrow(/already exists/);
    expect(
      await readFile(path.join(initial.target, 'user-note.txt'), 'utf8'),
    ).toBe('preserve me');
  });
  it('honors a declined confirmation', async () => {
    await installSkill(options());
    const confirmOverwrite = vi.fn(async () => false);
    await expect(
      installSkill({ ...options(), confirmOverwrite }),
    ).rejects.toThrow(/already exists/);
    expect(confirmOverwrite).toHaveBeenCalledOnce();
  });
  it.each(['flag', 'prompt'])(
    'replaces only after explicit authorization by %s',
    async (method) => {
      const initial = await installSkill(options());
      await writeFile(path.join(initial.target, 'obsolete.txt'), 'old');
      await writeFile(path.join(source, 'new.txt'), 'new');
      const result = await installSkill({
        ...options(),
        ...(method === 'flag'
          ? { overwrite: true }
          : { confirmOverwrite: async () => true }),
      });
      expect(result.replaced).toBe(true);
      expect(await exists(path.join(result.target, 'obsolete.txt'))).toBe(
        false,
      );
      expect(await readFile(path.join(result.target, 'new.txt'), 'utf8')).toBe(
        'new',
      );
    },
  );
  it('rolls back an existing skill if publishing the staged copy fails', async () => {
    const initial = await installSkill(options());
    await writeFile(path.join(initial.target, 'user-note.txt'), 'original');
    fault.publish = true;
    await expect(
      installSkill({ ...options(), overwrite: true }),
    ).rejects.toThrow(/Injected publish/);
    expect(
      await readFile(path.join(initial.target, 'user-note.txt'), 'utf8'),
    ).toBe('original');
    expect(await readdir(path.dirname(initial.target))).toEqual([
      'sample-skill',
    ]);
  });
  it('preserves a recoverable backup if rollback also fails', async () => {
    const initial = await installSkill(options());
    await writeFile(path.join(initial.target, 'user-note.txt'), 'recover me');
    fault.publish = true;
    fault.rollback = true;
    await expect(
      installSkill({ ...options(), overwrite: true }),
    ).rejects.toThrow(/Previous skill preserved at/);
    const entries = await readdir(path.dirname(initial.target));
    const staging = entries.find((name) =>
      name.startsWith('.agentskills-stage-'),
    )!;
    expect(
      await readFile(
        path.join(
          path.dirname(initial.target),
          staging,
          'previous',
          'user-note.txt',
        ),
        'utf8',
      ),
    ).toBe('recover me');
    expect(entries.some((name) => name.endsWith('.lock'))).toBe(false);
  });
  it('rejects an invalid skill before creating a destination', async () => {
    await writeFile(path.join(source, 'SKILL.md'), skillText('mismatched'));
    await expect(installSkill(options())).rejects.toThrow(/failed validation/);
    expect(await readdir(project)).toEqual([]);
  });
  it('validates staged content and preserves the old skill if the source changes after confirmation', async () => {
    const initial = await installSkill(options());
    await writeFile(path.join(initial.target, 'user-note.txt'), 'original');
    await expect(
      installSkill({
        ...options(),
        confirmOverwrite: async () => {
          await writeFile(
            path.join(source, 'SKILL.md'),
            '# Invalid after initial validation',
          );
          return true;
        },
      }),
    ).rejects.toThrow(/Staged skill failed validation/);
    expect(
      await readFile(path.join(initial.target, 'user-note.txt'), 'utf8'),
    ).toBe('original');
    expect(await readdir(path.dirname(initial.target))).toEqual([
      'sample-skill',
    ]);
  });
  it('releases its lock if the confirmation callback fails', async () => {
    const initial = await installSkill(options());
    await expect(
      installSkill({
        ...options(),
        confirmOverwrite: async () => {
          throw new Error('Prompt interrupted');
        },
      }),
    ).rejects.toThrow(/Prompt interrupted/);
    expect(await readdir(path.dirname(initial.target))).toEqual([
      'sample-skill',
    ]);
  });
  it('rejects escaping names and overlapping destinations', async () => {
    await expect(
      installSkill({ ...options(), name: '../escape' }),
    ).rejects.toThrow();
    const installed = await installSkill(options());
    await expect(
      installSkill({ ...options(), source: installed.target }),
    ).rejects.toThrow(/overlap/);
  });
  it('rejects a linked destination ancestor even with overwrite authorization', async () => {
    await symlink(home, path.join(project, '.agents'), 'junction');
    await expect(
      installSkill({ ...options(), overwrite: true }),
    ).rejects.toThrow(/Symlinks/);
    expect(await readdir(home)).toEqual([]);
  });
  it('rejects linked source files and linked existing resource directories', async () => {
    const initial = await installSkill(options());
    await symlink(home, path.join(initial.target, 'references'), 'junction');
    await expect(
      installSkill({ ...options(), overwrite: true }),
    ).rejects.toThrow(/Symlinks/);
    await symlink(home, path.join(source, 'references'), 'junction');
    await expect(installSkill(options())).rejects.toThrow(/failed validation/);
  });
  it('does not treat a file as a replaceable skill directory', async () => {
    const parent = path.join(project, '.agents', 'skills');
    await mkdir(parent, { recursive: true });
    await writeFile(path.join(parent, 'sample-skill'), 'keep');
    await expect(
      installSkill({ ...options(), overwrite: true }),
    ).rejects.toThrow(/not a directory/);
  });
  it('fails closed if another installer owns the destination lock', async () => {
    const parent = path.join(project, '.agents', 'skills');
    await mkdir(parent, { recursive: true });
    const lock = await open(
      path.join(parent, '.agentskills-sample-skill.lock'),
      'wx',
    );
    try {
      await expect(installSkill(options())).rejects.toThrow(/EEXIST/);
    } finally {
      await lock.close();
    }
    expect(await exists(path.join(parent, 'sample-skill'))).toBe(false);
  });
});
