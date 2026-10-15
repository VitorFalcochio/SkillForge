import path from 'node:path';
import {
  discoverSkillDirectories,
  errorMessage,
  exists,
  parseSkill,
  readTextFile,
  resolveLocalPath,
  SkillParseError,
  walkSkill,
} from '@agentskills/core';
import type { SkillDocument, SkillFile } from '@agentskills/core';
import GithubSlugger from 'github-slugger';
import { toString } from 'mdast-util-to-string';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export interface Diagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  skills: number;
  diagnostics: Diagnostic[];
}

const portableFields = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const parser = unified().use(remarkParse);

interface Reference {
  value: string;
  line: number;
}

function markdown(text: string): {
  references: Reference[];
  anchors: Set<string>;
} {
  const tree = parser.parse(text);
  const references: Reference[] = [];
  const anchors = new Set<string>();
  const slugger = new GithubSlugger();
  visit(tree, (node) => {
    const line = node.position?.start.line ?? 1;
    if (
      node.type === 'link' ||
      node.type === 'image' ||
      node.type === 'definition'
    ) {
      references.push({ value: node.url, line });
    } else if (
      node.type === 'inlineCode' &&
      /^(?:\.\/)?(?:references|scripts|assets|agents)[/\\][^\s]+$/.test(
        node.value,
      )
    ) {
      references.push({ value: node.value, line });
    } else if (node.type === 'heading') {
      anchors.add(slugger.slug(toString(node)));
    }
  });
  return { references, anchors };
}

async function checkReferences(
  root: string,
  files: SkillFile[],
  document: SkillDocument,
  diagnostics: Diagnostic[],
): Promise<void> {
  const parsed = new Map<string, ReturnType<typeof markdown>>();
  for (const file of files.filter((item) => /\.md$/i.test(item.relative))) {
    const text =
      file.relative === 'SKILL.md'
        ? document.body
        : await readTextFile(file.absolute);
    parsed.set(file.absolute, markdown(text));
  }
  const knownFiles = new Set(files.map((file) => file.absolute));
  const foldedFiles = new Set(files.map((file) => file.absolute.toLowerCase()));
  for (const [source, content] of parsed) {
    for (const reference of content.references) {
      const line =
        reference.line +
        (source === path.join(root, 'SKILL.md') ? document.bodyOffset : 0);
      const report = (
        code: string,
        message: string,
        severity: Diagnostic['severity'] = 'error',
      ) => diagnostics.push({ severity, code, path: source, line, message });
      const raw = reference.value;
      if (/^(https?:|mailto:|tel:)/i.test(raw)) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
        report(
          'UNSAFE_REFERENCE',
          `Unsupported URL scheme or absolute path: ${raw}. Use a local relative path or HTTPS URL.`,
        );
        continue;
      }
      try {
        const hash = raw.indexOf('#');
        const fragment =
          hash < 0 ? '' : decodeURIComponent(raw.slice(hash + 1));
        const pathname = decodeURIComponent(
          (hash < 0 ? raw : raw.slice(0, hash)).split('?')[0]!,
        );
        const target = pathname
          ? resolveLocalPath(root, path.dirname(source), pathname)
          : source;
        if (!(await exists(target))) {
          report(
            'MISSING_REFERENCE',
            `Referenced local file does not exist: ${raw}`,
          );
        } else if (
          !knownFiles.has(target) &&
          foldedFiles.has(target.toLowerCase())
        ) {
          report(
            'REFERENCE_CASE',
            `Reference must match the exact filename and case: ${raw}`,
          );
        } else if (
          fragment &&
          parsed.has(target) &&
          !parsed.get(target)!.anchors.has(fragment)
        ) {
          report(
            'BROKEN_ANCHOR',
            `Heading #${fragment} does not exist in ${pathname || path.basename(source)}.`,
          );
        } else if (fragment && !parsed.has(target)) {
          report(
            'UNCHECKED_ANCHOR',
            `Anchor in a non-Markdown file was not checked: ${raw}`,
            'warning',
          );
        }
      } catch (error) {
        report('UNSAFE_REFERENCE', errorMessage(error));
      }
    }
  }
}

async function validateOne(
  root: string,
  diagnostics: Diagnostic[],
): Promise<SkillDocument | undefined> {
  const entry = path.join(root, 'SKILL.md');
  const report = (
    code: string,
    message: string,
    severity: Diagnostic['severity'] = 'error',
  ) => diagnostics.push({ severity, code, path: entry, message });
  try {
    const files = await walkSkill(root);
    if (!files.some((file) => file.relative === 'SKILL.md')) {
      report(
        'MISSING_SKILL',
        'Add a regular file named exactly SKILL.md to this skill directory.',
      );
      return;
    }
    const document = parseSkill(await readTextFile(entry));
    if (document.metadata.name !== path.basename(root))
      report(
        'NAME_MISMATCH',
        `Frontmatter name "${document.metadata.name}" must match folder "${path.basename(root)}".`,
      );
    for (const key of Object.keys(document.metadata)) {
      if (!portableFields.has(key))
        report(
          'PLATFORM_METADATA',
          `"${key}" is outside the portable specification. Keep host extensions in agents/ or adapters.`,
          'warning',
        );
    }
    if (!document.body.trim())
      report(
        'EMPTY_BODY',
        'Add workflow instructions after the frontmatter.',
        'warning',
      );
    if (document.body.split('\n').length > 500)
      report(
        'LONG_BODY',
        'Keep SKILL.md under 500 lines; move conditional detail into references/.',
        'warning',
      );
    if (files.some((file) => file.relative.split(path.sep)[0] === 'scripts'))
      report(
        'UNTRUSTED_SCRIPTS',
        'Review bundled scripts before running them. Installation never executes scripts.',
        'warning',
      );
    if (document.metadata['allowed-tools'])
      report(
        'EXPERIMENTAL_TOOLS',
        'allowed-tools is experimental; host enforcement has not been verified.',
        'warning',
      );
    await checkReferences(root, files, document, diagnostics);
    return document;
  } catch (error) {
    report(
      error instanceof SkillParseError ? error.code : 'FILESYSTEM',
      errorMessage(error),
    );
  }
}

/** Validate one skill or a category tree. Errors fail validation; warnings remain reviewable. */
export async function validate(target: string): Promise<ValidationResult> {
  const diagnostics: Diagnostic[] = [];
  let directories: string[];
  try {
    directories = await discoverSkillDirectories(path.resolve(target));
  } catch (error) {
    return {
      valid: false,
      skills: 0,
      diagnostics: [
        {
          severity: 'error',
          code: 'DISCOVERY',
          path: path.resolve(target),
          message: errorMessage(error),
        },
      ],
    };
  }
  const names = new Map<string, string>();
  let skills = 0;
  for (const directory of directories) {
    const document = await validateOne(directory, diagnostics);
    if (!document) continue;
    skills++;
    const previous = names.get(document.metadata.name);
    if (previous)
      diagnostics.push({
        severity: 'error',
        code: 'DUPLICATE_NAME',
        path: path.join(directory, 'SKILL.md'),
        message: `Duplicate identifier "${document.metadata.name}"; also defined in ${previous}. Rename one skill and its folder.`,
      });
    names.set(document.metadata.name, directory);
  }
  return {
    valid: !diagnostics.some((item) => item.severity === 'error'),
    skills,
    diagnostics,
  };
}

export * from './agents.js';
