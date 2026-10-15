# Security policy and model

AgentSkills validates and copies local skill content. Validation is structural;
it does not certify that instructions or scripts are trustworthy.

## Report a vulnerability

Do not post secrets or an active exploit in a public issue. Use the repository's
private vulnerability reporting feature if enabled (Security → Report a
vulnerability). Otherwise contact a repository maintainer through a private
channel listed on their profile. No dedicated security address, response SLA,
or hosted reporting configuration has been established in this initial checkout.
The owner must configure a private reporting channel before public launch.

Include the affected revision, operating system and Node.js version, smallest
safe reproduction, observed impact, and suggested mitigation if known. Only the
current source release is maintained during this initial phase.

## Trust boundaries

- Treat skill instructions, metadata, links, assets, and scripts as untrusted until
  reviewed. A skill can influence what an agent does later.
- Only local catalog content is supported. There is no remote fetch, archive
  extraction, repository download, dependency resolution, or script execution in
  the skill installer. External documentation links are never requested by validation.
- Installing a skill gives the destination agent access to that content. The
  agent's own permissions govern later use; this CLI does not sandbox an agent.
- Dependency lifecycle scripts are disabled. Review dependency updates and the
  committed lockfile as part of the software supply chain.

## Evaluation suites

Evaluation suites, fixtures, and recorded results are untrusted data. The `eval`
command parses them with strict schemas and size limits, resolves fixture and
output paths inside the suite directory, rejects links and junctions, and grades
output with plain substring checks rather than contributed regular expressions.
It never executes fixtures, starts an agent, calls a model, or reads environment
secrets. Fixtures may deliberately contain unsafe example content, such as the
`skill-reviewer` remote-installer sample; they live outside `skills/` so they are
never installed. Do not run fixture scripts; their example URLs use the reserved
`.invalid` domain.

When recording agent runs, use an isolated test project and synthetic data. A
recorded output may contain anything the agent produced, so review it for secrets
before committing it.

## Filesystem defenses

Identifiers must match the portable naming rules and their source folder. Paths
are resolved within explicit roots; both slash styles, Windows drive paths,
UNC paths, reserved Windows names, control characters, and alternate data stream
syntax are handled defensively. URL-encoded reference paths are decoded before
containment checks. Case collisions are rejected for portability.

Source trees and existing path components must not contain symlinks or Windows
junctions. The trusted project/home base is canonicalized once; links below it
are rejected, including in a tree about to be replaced. Reference validation
never reads a file outside the walked skill tree.

Walking is limited to 1,000 filesystem entries per skill, 2 MiB per file, 20 MiB
total file content, and depth 32. Catalog discovery limits directory visits to
1,000 and depth 32. These bounds reduce accidental resource exhaustion; they are
not a sandbox for adversarial processes or filesystems.

The installer uses a per-name exclusive lock, stages regular files in the
destination filesystem, sets copied files to read/write-owner and read-only-other
mode where supported (`0644`), and validates staged content. It requires explicit
authorization before replacing a whole skill directory. It retains the previous
tree while publishing, restores it on handled publish failure, and preserves a
backup with its location in the error if restoration also fails.

## Remaining limitations and recovery

- Filesystem checks and copies are separate operations. A hostile process with
  concurrent write access can race them. Use a trusted, quiescent local workspace;
  the implementation does not offer descriptor-relative OS sandbox guarantees.
- The lock coordinates AgentSkills installers only. It does not lock an editor,
  a running agent, another installer, or a process changing permissions. Source
  content and the destination must remain stable during installation.
- Replacement uses two renames. A reader can briefly observe a missing destination.
  A power loss or killed process can leave a lock, staging directory, or backup;
  crash recovery and durable filesystem transactions are not implemented.
- After an interrupted install, confirm no installer is running, inspect
  `.agentskills-<name>.lock` and `.agentskills-stage-*` under the destination root,
  and recover the `previous/` tree if necessary before manually removing leftovers.
  Never delete another active installer's lock. A cleanup failure can be reported
  after the new skill was already installed; inspect the destination before retrying.
- Markdown checks cover parsed links, images, definitions, relative headings, and
  standalone inline-code resource paths. They do not inspect raw HTML links, shell
  commands, arbitrary prose paths, runtime interpolation, or platform YAML resources.
  URL reachability and non-Markdown fragments are not verified. Undefined Markdown
  reference labels may parse as plain text. See [authoring](docs/creating-skills.md).
- Evaluation grading cannot detect whether an agent run was performed honestly or
  in isolation; result files are trusted only as far as their author.
- YAML aliases are intentionally rejected. Platform-specific metadata is warned
  about, not interpreted as permissions. All installed content still needs review.
