import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertPortablePath,
  installationPath,
  isWithin,
  parseSkill,
  resolveLocalPath,
  skillNameSchema,
} from '../packages/core/dist/index.js';
import { skillText } from './helpers.js';

describe('portable metadata', () => {
  it('accepts required and supported optional metadata', () => {
    const document = parseSkill(
      '---\nname: sample-skill\ndescription: Review changes when requested.\nlicense: MIT\nmetadata:\n  version: "1.0"\ncompatibility: Node.js\nallowed-tools: Read\n---\n# Workflow\n',
    );
    expect(document.metadata.metadata).toEqual({ version: '1.0' });
    expect(document.body).toBe('# Workflow\n');
    expect(document.bodyOffset).toBe(9);
  });
  it('enforces description length before considering whitespace', () => {
    const document = (description: string) =>
      `---\nname: sample-skill\ndescription: ${JSON.stringify(description)}\n---\n# Workflow\n`;
    expect(
      parseSkill(document('x'.repeat(1024))).metadata.description,
    ).toHaveLength(1024);
    expect(() => parseSkill(document('x'.repeat(1025)))).toThrow();
    expect(() => parseSkill(document(' '.repeat(1024) + 'x'))).toThrow();
  });
  it('handles BOM and CRLF', () =>
    expect(
      parseSkill(`\uFEFF${skillText().replace(/\n/g, '\r\n')}`).metadata.name,
    ).toBe('sample-skill'));
  it.each([
    'Bad-Name',
    '../escape',
    'a--b',
    '-name',
    'name-',
    '',
    'a'.repeat(65),
  ])('rejects invalid identifier %j', (name) =>
    expect(skillNameSchema.safeParse(name).success).toBe(false),
  );
  it.each([
    'name: sample-skill',
    '---\nname: [broken\n---\nbody',
    '---\nname: sample-skill\nname: other\ndescription: test\n---\nbody',
    '---\nname: sample-skill\ndescription: " "\n---\nbody',
    '---\nname: sample-skill\ndescription: 42\n---\nbody',
    '---\nname: sample-skill\ndescription: test\nmetadata:\n  count: 2\n---\nbody',
    '---\nname: &name sample-skill\ndescription: *name\n---\nbody',
  ])('rejects malformed frontmatter %j', (text) =>
    expect(() => parseSkill(text)).toThrow(),
  );
});

describe('filesystem path boundaries', () => {
  const root = path.resolve('sandbox');
  it('compares directory boundaries rather than string prefixes', () => {
    expect(isWithin(root, `${root}-sibling/file`)).toBe(false);
    expect(isWithin(root, path.join(root, 'inside'))).toBe(true);
    expect(isWithin(root, path.dirname(root))).toBe(false);
  });
  it.each([
    '../secret',
    '..\\secret',
    '/etc/passwd',
    'C:\\secret',
    'C:relative',
    '\\\\server\\share',
    'file:stream',
    'assets/nul.txt',
    'assets/file.',
  ])('rejects unsafe reference %j', (reference) =>
    expect(() => resolveLocalPath(root, root, reference)).toThrow(),
  );
  it('allows a nested document to refer to another file inside the skill', () =>
    expect(
      resolveLocalPath(
        root,
        path.join(root, 'references'),
        '../assets/test.json',
      ),
    ).toBe(path.join(root, 'assets', 'test.json')));
  it.each(['con', 'COM1', 'nul.txt', 'name ', 'trailing.', 'bad\u0000name'])(
    'rejects nonportable filename %j',
    (name) => expect(() => assertPortablePath(name)).toThrow(),
  );
});

describe('platform adapters', () => {
  const project = path.resolve('project with spaces');
  const home = path.resolve('user home');
  it.each([
    ['claude', 'project', project, '.claude'],
    ['claude', 'user', home, '.claude'],
    ['codex', 'project', project, '.agents'],
    ['codex', 'user', home, '.agents'],
  ] as const)('maps %s %s scope', (agent, scope, base, folder) => {
    const result = installationPath({
      agent,
      scope,
      name: 'sample-skill',
      project,
      home,
    });
    expect(result.target).toBe(
      path.join(base, folder, 'skills', 'sample-skill'),
    );
    expect(isWithin(result.root, result.target)).toBe(true);
  });
  it.each(['../escape', '..\\escape', 'C:\\escape', 'con'])(
    'rejects unsafe install name %j',
    (name) =>
      expect(() =>
        installationPath({
          agent: 'codex',
          scope: 'project',
          name,
          project,
          home,
        }),
      ).toThrow(),
  );
  it.each(['synced', 'anthropic-skills'])(
    'rejects reserved Claude name %s',
    (name) =>
      expect(() =>
        installationPath({
          agent: 'claude',
          scope: 'project',
          name,
          project,
          home,
        }),
      ).toThrow(/reserves/),
  );
});
