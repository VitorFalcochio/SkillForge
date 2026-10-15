import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadCatalog, walkSkill } from '../packages/core/dist/index.js';
import type { CatalogSkill } from '../packages/core/dist/index.js';
import { installSkill } from '../packages/cli/src/install.js';
import { validate } from '../packages/validator/dist/index.js';
import { cleanup, temporaryDirectory } from './helpers.js';

const catalog = fileURLToPath(new URL('../skills', import.meta.url));

// Contribution requirements from docs/creating-skills.md, as used by every bundled skill.
const sections = [
  'Inputs and outputs',
  'Workflow',
  'Constraints',
  'Verification criteria',
  'Example',
];

describe('bundled skill catalog', () => {
  let skills: CatalogSkill[];
  beforeAll(async () => {
    skills = await loadCatalog(catalog);
  });

  it('contains the expected skills in their categories', () => {
    const meta = [
      'skill-creator',
      'skill-evaluator',
      'skill-optimizer',
      'skill-reviewer',
    ];
    expect(
      skills.map((skill) => [skill.metadata.name, skill.category]),
    ).toEqual(
      [
        'ai-agent-architect',
        'api-architect',
        'bug-investigator',
        'code-auditor',
        'database-architect',
        'devops-engineer',
        'documentation-engineer',
        'nextjs-engineer',
        'performance-engineer',
        'python-engineer',
        'react-engineer',
        'security-reviewer',
        'skill-creator',
        'skill-evaluator',
        'skill-optimizer',
        'skill-reviewer',
        'test-engineer',
        'ui-architect',
      ].map((name) => [name, meta.includes(name) ? 'meta' : 'development']),
    );
  });

  it('declares portable metadata with an activation clause', () => {
    for (const { metadata } of skills) {
      expect(Object.keys(metadata).sort(), metadata.name).toEqual([
        'description',
        'license',
        'name',
      ]);
      expect(metadata.license).toBe('MIT');
      expect(metadata.description, metadata.name).toMatch(/\bUse (for|when)\b/);
    }
  });

  it('documents every required section in order', () => {
    for (const { metadata, body } of skills) {
      const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) =>
        match[1]!.trim(),
      );
      expect(headings, metadata.name).toEqual(sections);
      expect(body, metadata.name).toMatch(/^# \S/m);
      expect(body, metadata.name).toMatch(/^1\. /m);
    }
  });

  it('links every bundled reference from its SKILL.md', async () => {
    for (const { metadata, directory, body } of skills) {
      const entries = await readdir(path.join(directory, 'references')).catch(
        () => [],
      );
      expect(entries.length, metadata.name).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(body, `${metadata.name}/${entry}`).toContain(
          `(references/${entry})`,
        );
        const text = await readFile(
          path.join(directory, 'references', entry),
          'utf8',
        );
        expect(text, `${metadata.name}/${entry}`).toMatch(/^# \S/);
      }
    }
  });

  describe('local installation smoke test', () => {
    let root: string;
    beforeEach(async () => {
      root = await temporaryDirectory();
    });
    afterEach(async () => cleanup(root));

    it.each(['claude', 'codex'] as const)(
      'installs every bundled skill for %s with identical contents',
      async (agent) => {
        const project = path.join(root, 'project');
        const home = path.join(root, 'home');
        await mkdir(project);
        await mkdir(home);
        const files = async (directory: string) =>
          (await walkSkill(directory)).map((file) => file.relative).sort();
        for (const skill of skills) {
          const { target } = await installSkill({
            source: skill.directory,
            name: skill.metadata.name,
            agent,
            scope: 'project',
            project,
            home,
          });
          expect(await files(target), skill.metadata.name).toEqual(
            await files(skill.directory),
          );
        }
        const installed = path.join(
          project,
          agent === 'claude' ? '.claude' : '.agents',
          'skills',
        );
        expect(await validate(installed)).toEqual({
          valid: true,
          skills: skills.length,
          diagnostics: [],
        });
      },
    );
  });
});
