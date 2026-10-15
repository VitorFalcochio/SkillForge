# Python practice notes

Use only the sections relevant to the task. Project configuration overrides these defaults.

## Detecting the toolchain

| Evidence                                       | Tool            | Run and add dependencies with         |
| ---------------------------------------------- | --------------- | ------------------------------------- |
| `uv.lock`                                      | uv              | `uv run`, `uv add`                    |
| `poetry.lock` or a `[tool.poetry]` table       | Poetry          | `poetry run`, `poetry add`            |
| `pdm.lock`                                     | PDM             | `pdm run`, `pdm add`                  |
| `Pipfile.lock`                                 | Pipenv          | `pipenv run`, `pipenv install`        |
| `[tool.hatch]` table or `hatch.toml`           | Hatch           | `hatch run`                           |
| `requirements.in` beside compiled requirements | pip-tools       | Edit the `.in` file, then recompile   |
| Only `requirements*.txt`                       | pip with a venv | Activated project virtual environment |

Also inspect `[tool.ruff]`, `[tool.black]`, `[tool.mypy]`, `[tool.pyright]`,
`[tool.pytest.ini_options]`, `tox.ini`, `noxfile.py`, and pre-commit configuration.
CI workflow files usually reveal the authoritative commands and Python versions.
If no tool is evident, ask, or use a project-local virtual environment and say so.

## Typing

- Annotations are evaluated at runtime by libraries such as Pydantic and
  dataclass-based frameworks. Postponed evaluation and import guards under
  `TYPE_CHECKING` can break them; check before changing annotation style.
- Prefer `Protocol` for structural interfaces that callers implement.
- Narrow with `isinstance` or explicit checks instead of `cast`; a cast is an
  unchecked claim.
- Typed libraries ship a `py.typed` marker in the package.
- Newer syntax such as `X | Y` at runtime (3.10), `Self` (3.11), and `type`
  statements (3.12) requires that minimum version or a `typing_extensions` import
  the project already allows.

## Async

- `asyncio.gather` does not cancel sibling tasks when one fails; `TaskGroup`
  (3.11+) cancels the remaining tasks and raises an `ExceptionGroup`, handled
  with `except*`.
- Use `asyncio.timeout` on 3.11+ and `asyncio.wait_for` on earlier versions.
- The event loop keeps only weak references to tasks; store references to tasks
  created with `create_task` until they finish.
- Synchronous HTTP clients and many database drivers block the loop. Use an async
  equivalent or `asyncio.to_thread` (3.9+).
- Do not call `asyncio.run` from code that may already run inside an event loop.
- If the project uses AnyIO or Trio, follow their cancellation-scope model instead.

## Errors and logging

Give a library one base exception so callers can catch its failures together.
Catch broad exceptions only at a process or request boundary, and record the
traceback there with `logger.exception`. Use module-level loggers named with
`__name__`; libraries should not configure logging handlers. Never log secrets
or full request bodies containing personal data.

## Packaging

- Declare metadata in the `[project]` table and the backend in `[build-system]`.
- A `src/` layout ensures tests run against the installed package rather than the
  working tree. Follow the existing layout unless a change is agreed.
- Declare console commands in `[project.scripts]`.
- Package data inclusion is backend-specific. Build the wheel and inspect its
  contents, since a wheel is a zip archive, then install it into a fresh
  environment and import it.
- Keep the version in one place, either static metadata or the backend's dynamic
  version source.

## Testing

- Use `pytest.raises(..., match=...)` to assert both exception type and message.
- Prefer parametrized cases with readable IDs to loops inside one test.
- Inject a clock or use the time-mocking library already present instead of sleeping.
- Choose fixture scope deliberately; shared mutable fixtures create order-dependent tests.
- Cover error paths, boundary values, and cancellation, not only success.
