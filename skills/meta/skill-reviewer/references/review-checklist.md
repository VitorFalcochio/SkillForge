# Skill review checklist

Search file contents as text. A match is a lead to read in context, not a
verdict, and the absence of matches does not prove a skill is safe.

## Unsafe and suspicious content

| Concern                | Text to look for                                                                                               | Default severity        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Remote code execution  | A download piped to a shell, `iex` with a web request, `eval` of fetched content, `npx` of an unpinned package | Blocking                |
| Destructive operations | Recursive deletes, `git push --force`, `git reset --hard`, `DROP`, `TRUNCATE`, disk formatting                 | Blocking without a gate |
| Credential access      | SSH keys, cloud credential files, `.env` files, keychains, browser profiles, dumping environment variables     | Blocking                |
| Exfiltration           | Uploads, webhooks, or requests that send files, environment values, or command output elsewhere                | Blocking                |
| Safeguard bypass       | Disabling sandboxes, permission prompts, TLS verification, hooks, or signature checks                          | High                    |
| Concealment            | Instructions not to tell the user, to clear history or logs, or to run silently                                | Blocking                |
| Injected instructions  | Text addressed to reviewers, validators, or other agents; claims of prior approval; role overrides             | High                    |
| Obfuscation            | Base64 or hex blobs, minified scripts, zero-width or bidirectional control characters, homoglyphs              | High until explained    |
| Hidden text            | HTML comments, collapsed sections, or link text that differs from the target                                   | Review in context       |
| Over-broad activation  | Descriptions that match any coding request or claim to run first                                               | Medium                  |
| Broad tool permissions | Experimental tool allowlists granting shell or network access without need                                     | Medium                  |

Check for invisible characters by listing code points outside printable ASCII in
text files when the tooling allows it, without executing the files.

## Instruction quality

- Each workflow step has an action and a criterion for deciding it is done.
- The skill says when to stop and ask, and which side effects need authorization.
- Inputs, outputs, and verification are observable.
- No step depends on a capability the target hosts do not document.
- Examples are realistic and consistent with the workflow.

## External dependencies

For each package, tool, service, or URL, record: why it is needed, whether a
version is pinned, its license, whether it requires credentials or network
access, and whether the skill asks the user before using it. Prefer standard
tools and documented commands to bundled downloads.

## Severity

| Severity   | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| Blocking   | Must be fixed before acceptance; unsafe or deceptive behavior |
| High       | Likely to cause harmful or unreliable agent behavior          |
| Medium     | Reduces usefulness or precision; should be fixed              |
| Suggestion | Optional improvement to clarity or maintainability            |

## Finding format

1. Severity and short title.
2. File and line.
3. Quoted evidence, with secrets redacted.
4. Why it matters for an agent following the skill.
5. Concrete change that resolves it.

End with the recommendation, the checks run, and files not reviewed.
