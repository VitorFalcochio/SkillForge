import { mkdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LIMITS, loadCatalog } from '../packages/core/dist/index.js';
import { validate } from '../packages/validator/dist/index.js';
import {
  cleanup,
  makeSkill,
  skillText,
  temporaryDirectory,
} from './helpers.js';

describe('skill validation', () => {
  let root: string;
  beforeEach(async () => {
    root = await temporaryDirectory();
  });
  afterEach(async () => cleanup(root));
  const codes = async (target: string) =>
    (await validate(target)).diagnostics.map((item) => item.code);

  it('validates a minimal skill without optional directories', async () =>
    expect(await validate(await makeSkill(root))).toEqual({
      valid: true,
      skills: 1,
      diagnostics: [],
    }));
  it('reports the bundled invalid fixture with a source location', async () => {
    const fixture = fileURLToPath(
      new URL('./fixtures/broken-reference', import.meta.url),
    );
    const result = await validate(fixture);
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'MISSING_REFERENCE',
        line: 8,
        path: path.join(fixture, 'SKILL.md'),
      }),
    ]);
  });
  it('reports a missing entry point and a missing path', async () => {
    expect(await codes(root)).toContain('MISSING_SKILL');
    expect(await codes(path.join(root, 'absent'))).toContain('DISCOVERY');
  });
  it('rejects a file instead of a skill directory', async () => {
    const skill = await makeSkill(root);
    expect(await codes(path.join(skill, 'SKILL.md'))).toContain('DISCOVERY');
  });
  it.each([
    ['---\nname: [broken\n---\nbody', 'YAML'],
    ['---\nname: sample-skill\n---\nbody', 'METADATA'],
    ['# Missing frontmatter', 'FRONTMATTER'],
    [skillText('wrong-name'), 'NAME_MISMATCH'],
  ])('diagnoses malformed skill: %s', async (text, code) =>
    expect(
      await codes(await makeSkill(root, 'sample-skill', { 'SKILL.md': text })),
    ).toContain(code),
  );
  it('finds duplicates across categories and refuses an ambiguous catalog', async () => {
    await makeSkill(path.join(root, 'one'));
    await makeSkill(path.join(root, 'two'));
    expect(await codes(root)).toContain('DUPLICATE_NAME');
    await expect(loadCatalog(root)).rejects.toThrow(/Duplicate/);
  });
  it('orders a category catalog by identifier', async () => {
    await makeSkill(path.join(root, 'development'), 'z-skill');
    await makeSkill(path.join(root, 'research'), 'a-skill');
    expect(
      (await loadCatalog(root)).map((skill) => [
        skill.metadata.name,
        skill.category,
      ]),
    ).toEqual([
      ['a-skill', 'research'],
      ['z-skill', 'development'],
    ]);
  });
  it('follows Markdown links, reference-style links, images, inline resource paths, and nested documents', async () => {
    const skill = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText(
        'sample-skill',
        '[guide](references/guide.md#details)\n![image](assets/icon.svg)\n[appendix][ref]\n[ref]: references/guide.md\n`assets/data.json`',
      ),
      'references/guide.md': '# Details\n[Data](../assets/data.json)\n',
      'assets/icon.svg': '<svg/>',
      'assets/data.json': '{}',
    });
    expect((await validate(skill)).diagnostics).toEqual([]);
  });
  it('validates same-file and duplicate-heading anchors', async () => {
    const skill = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText(
        'sample-skill',
        '# Title\n# Title\n[second](#title-1)\n[bad](#absent)',
      ),
    });
    const result = await validate(skill);
    expect(result.diagnostics.map((item) => item.code)).toEqual([
      'BROKEN_ANCHOR',
    ]);
    expect(result.diagnostics[0]?.line).toBe(8);
  });
  it.each([
    '[missing](references/absent.md)',
    '![missing](assets/absent.svg)',
    '`scripts/absent.py`',
    '[missing][target]\n\n[target]: references/absent.md',
  ])('detects missing reference %s', async (body) =>
    expect(
      await codes(
        await makeSkill(root, 'sample-skill', {
          'SKILL.md': skillText('sample-skill', body),
        }),
      ),
    ).toContain('MISSING_REFERENCE'),
  );
  it.each([
    '../secret',
    '..%2fsecret',
    '%2e%2e%5csecret',
    '/etc/passwd',
    'C:/secret',
    'file:///secret',
    'javascript:alert',
    '//server/share',
    'assets/%00bad',
    'references/%zz',
  ])('rejects unsafe link %s', async (url) =>
    expect(
      await codes(
        await makeSkill(root, 'sample-skill', {
          'SKILL.md': skillText('sample-skill', `[bad](<${url}>)`),
        }),
      ),
    ).toContain('UNSAFE_REFERENCE'),
  );
  it('does not request network URLs or interpret code block examples as links', async () => {
    const body =
      '[external](https://example.invalid/guide#anything)\n```md\n[example](absent.md)\n```';
    expect(
      await codes(
        await makeSkill(root, 'sample-skill', {
          'SKILL.md': skillText('sample-skill', body),
        }),
      ),
    ).toEqual([]);
  });
  it('reports exact filename casing errors on all operating systems', async () => {
    const skill = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText('sample-skill', '[guide](references/guide.md)'),
      'references/Guide.md': '# Guide',
    });
    expect((await validate(skill)).valid).toBe(false);
  });
  it('checks exact casing for extensionless local resources', async () => {
    const skill = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText(
        'sample-skill',
        '[build instructions](references/makefile)',
      ),
      'references/Makefile': '# Resource',
    });
    expect((await validate(skill)).valid).toBe(false);
  });
  it('separates warnings from errors', async () => {
    const text =
      '---\nname: sample-skill\ndescription: Review a repository when requested.\nmodel: host-specific\nallowed-tools: Read\n---\n';
    const result = await validate(
      await makeSkill(root, 'sample-skill', {
        'SKILL.md': text,
        'scripts/review.js': 'throw new Error("do not execute")',
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'EMPTY_BODY',
        'PLATFORM_METADATA',
        'UNTRUSTED_SCRIPTS',
        'EXPERIMENTAL_TOOLS',
      ]),
    );
    expect(
      result.diagnostics.every((item) => item.severity === 'warning'),
    ).toBe(true);
  });
  it('warns about unchecked fragments and excessively long entry points', async () => {
    const body = '[fragment](assets/data.json#item)\n' + '\n'.repeat(501);
    const skill = await makeSkill(root, 'sample-skill', {
      'SKILL.md': skillText('sample-skill', body),
      'assets/data.json': '{}',
    });
    expect(await codes(skill)).toEqual(
      expect.arrayContaining(['UNCHECKED_ANCHOR', 'LONG_BODY']),
    );
  });
  it('rejects a symlink/junction in skill resources', async () => {
    const outside = path.join(root, 'outside');
    await mkdir(outside);
    const skill = await makeSkill(root);
    await symlink(outside, path.join(skill, 'references'), 'junction');
    expect(await codes(skill)).toContain('FILESYSTEM');
  });
  it('rejects symlinked catalog categories', async () => {
    await makeSkill(path.join(root, 'outside'));
    const catalog = path.join(root, 'catalog');
    await mkdir(catalog);
    await symlink(
      path.join(root, 'outside'),
      path.join(catalog, 'development'),
      'junction',
    );
    expect(await codes(catalog)).toContain('DISCOVERY');
  });
  it('bounds file sizes before parsing', async () => {
    const skill = await makeSkill(root);
    await writeFile(
      path.join(skill, 'large.txt'),
      'x'.repeat(LIMITS.bytesPerFile + 1),
    );
    expect(await codes(skill)).toContain('FILESYSTEM');
  });
  it('keeps a missing entry point visible when resources are present', async () => {
    await mkdir(path.join(root, 'references'));
    await writeFile(path.join(root, 'references', 'guide.md'), '# Guide');
    const result = await validate(root);
    expect(result.diagnostics[0]?.path).toBe(path.join(root, 'SKILL.md'));
    expect(result.valid).toBe(false);
  });
});
