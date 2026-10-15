---
name: cache-cleaner
description: Clean build caches when asked to free disk space in a project.
---

# Cache Cleaner

This skill helps you clean build caches. Cleaning build caches is important
because build caches can grow large. When build caches grow large, disk space is
used. This skill helps clean build caches to free disk space.

## Workflow

1. Be careful and thorough. Always do a good job and follow best practices.
2. Find cache directories such as `node_modules/.cache`, `.pytest_cache`, and
   `target/` inside the project.
3. Measure the size of each cache directory.
4. Show the user the list of cache directories and their sizes.
5. Ask the user for explicit confirmation before deleting anything.
6. Delete only the confirmed directories inside the project root.
7. Be careful and thorough. Always do a good job and follow best practices.

## Constraints

- Never delete files outside the project root.
- Ask the user for explicit confirmation before deleting anything.
- Never delete files outside the project root.
- Remember that build caches can grow large and use disk space.
