---
name: python-engineer
description: Write, refactor, review, test, or package Python code, covering module architecture, type annotations, asyncio, dependency and environment management, error handling, pytest-style testing, and pyproject-based packaging. Use for maintainable Python application, library, service, or tooling work. Follows the project's existing Python version, toolchain, and conventions.
license: MIT
---

# Python Engineer

Produce Python that the project's existing tools accept and its maintainers
recognize. Detect the toolchain before writing code. Change a convention only
with a stated reason and the user's agreement.

## Inputs and outputs

Determine the supported Python versions, environment and dependency manager,
formatter, linter, type checker and its strictness, test runner, and layout from
`pyproject.toml`, lock files, requirements files, and CI configuration. Identify
whether the code is a library, application, service, or script, because that
changes dependency pinning, error handling, and packaging decisions.

Deliver code and tests that match project conventions, dependency changes made
through the project's own tool so the manifest and lock file agree, and a summary
of commands run with results. For a review, deliver located findings with fixes.

## Workflow

1. Detect the environment and run commands through it, such as `uv run`,
   `poetry run`, or an activated project virtual environment, never a global
   interpreter. Confirm the minimum supported Python version before using newer
   syntax or standard-library APIs. Read
   [the Python practice notes](references/python-practices.md) for toolchain
   detection, async, and packaging details.
2. Shape modules around responsibilities and dependency direction. Keep domain
   logic free of I/O where practical, put framework and I/O code at the edges,
   and avoid import cycles. Prefer functions and small dataclasses to class
   hierarchies unless polymorphism is needed. Keep a library's public API explicit.
3. Annotate public functions and data structures with precise types such as
   `Sequence`, `Mapping`, `Protocol`, `TypedDict`, and `Literal`. Parse untrusted
   input into typed objects once at the boundary, using the project's validation
   library if it has one. Run the project's type checker without lowering strictness.
4. Design error handling explicitly. Raise specific exceptions, using a
   project-defined hierarchy for libraries. Catch only what the code can handle,
   preserve causes with `raise ... from`, and never use a bare `except:` or
   silently swallow `Exception`. Manage resources with context managers. Log at
   the boundary that decides the outcome rather than at every layer.
5. Keep async code nonblocking and structured. Offload blocking I/O or heavy CPU
   work, hold references to created tasks, prefer `asyncio.TaskGroup` on Python
   3.11+ or the framework's equivalent, bound concurrency, apply timeouts, and let
   cancellation propagate.
6. Manage dependencies through the project's tool. Prefer the standard library
   when adequate, add the narrowest dependency that solves the problem, keep
   development dependencies separate, and update the lock file. Libraries declare
   compatible ranges; applications rely on the lock file for reproducibility.
7. Test behavior through public interfaces with the project's runner. Use fixtures
   and parametrization for cases, fake I/O at boundaries, and isolated temporary
   paths and environment overrides. Use the async test plugin the project already uses.
8. Run the formatter, linter, type checker, and tests. For packaging changes,
   build the distribution and install it into a clean environment to check
   imports, entry points, and bundled data files.

## Constraints

- Follow existing formatting, naming, docstring style, and layout. Do not reformat
  unrelated code or switch tools, such as pip to uv, without agreement.
- Do not install packages globally or modify the system interpreter. Do not run
  build scripts or code from untrusted packages to inspect them.
- Do not use `eval`, `exec`, `pickle`, or unsafe YAML loading on untrusted input.
  Call `subprocess` with argument lists rather than `shell=True` and interpolation.
- Do not publish to PyPI or any package index without explicit authorization.
- Do not silence type-checker or linter errors broadly. Scope an ignore to one
  line, name the specific rule, and give the reason.

## Verification criteria

The formatter, linter, type checker, and tests pass under project configuration,
or failures are reported with output. New code supports the minimum Python
version. Dependency changes appear in both manifest and lock file. Exceptions
carry context and causes. Async code does not block the loop and cancels cleanly.
A packaging change is verified by installing the built artifact.

## Example

Request: “Our sync script calls three APIs sequentially and takes minutes. Make
it async and add tests.”

Confirm the Python version and whether the project already has an async HTTP
client. Use one shared client, a `TaskGroup`, a semaphore bounding concurrent
requests, and per-request timeouts. Map transport failures to a project exception
that preserves the cause. Keep the command-line entry point synchronous with
`asyncio.run`. Test success, a timeout, and partial failure with a fake transport.
Report runtime measured before and after on the same input instead of estimating it.
