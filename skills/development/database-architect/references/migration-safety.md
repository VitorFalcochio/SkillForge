# Migration safety and query analysis

These notes cover common cases. Confirm behavior in the documentation for the
exact engine and version in use before relying on it.

## Expand, migrate, contract

1. **Expand.** Add nullable columns, new tables, or new indexes that old
   application versions ignore. Deploy code that writes both old and new shapes.
2. **Backfill.** Copy data in batches keyed by primary-key ranges. Commit each
   batch, throttle, make it idempotent and resumable, and watch replication lag
   and lock waits.
3. **Switch.** Move reads to the new shape. Verify with comparison queries that
   report mismatched rows rather than assuming the backfill was complete.
4. **Contract.** Add constraints, then remove old structures in a later release
   once no running application version uses them.

Renaming a column or table is a contract change for running application versions
even when the engine treats it as metadata-only.

## Lock and rewrite risks

| Operation                    | PostgreSQL                                                                               | Safer pattern                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Add column, constant default | Metadata-only since version 11; a volatile default rewrites the table                    | Add nullable, backfill in batches, then set the default  |
| Create index                 | Plain build blocks writes for its duration                                               | `CREATE INDEX CONCURRENTLY`, outside a transaction block |
| Add foreign key              | Validation scans the table                                                               | Add with `NOT VALID`, then `VALIDATE CONSTRAINT`         |
| Add check constraint         | Validation scans the table                                                               | Add with `NOT VALID`, then `VALIDATE CONSTRAINT`         |
| Set `NOT NULL`               | Scans under an exclusive lock; since version 12 skipped if a valid matching check exists | Validate a `CHECK (col IS NOT NULL)` first               |
| Change column type           | Usually rewrites the table and its indexes                                               | New column, backfill, switch, drop old                   |

PostgreSQL DDL waiting for a lock blocks later queries on the same table. Set
`lock_timeout` for migrations and retry rather than letting a queue form.

For MySQL and MariaDB, state `ALGORITHM` and `LOCK` explicitly in `ALTER TABLE`
so an unsupported online change fails instead of silently falling back to a
blocking table copy. Many changes support `INSTANT` or `INPLACE` depending on
version and operation; check the online DDL documentation for the exact change.

SQLite supports few `ALTER TABLE` forms. Other changes follow the documented
rebuild procedure: create the new table, copy rows, drop the old table, and
rename, inside a transaction with foreign-key enforcement handled as documented.

For SQL Server, online index operations depend on edition. Check before planning
on `ONLINE = ON`.

## Rollback

Each expand step should have a tested reverse migration. Contract steps that
destroy data are irreversible; require a verified backup or snapshot and an
explicit authorization, and keep the old structure until the new one has been
verified in production for an agreed period.

## Reading query plans

| Engine     | Plan with actual execution                       | Plan without execution   |
| ---------- | ------------------------------------------------ | ------------------------ |
| PostgreSQL | `EXPLAIN (ANALYZE, BUFFERS)`                     | `EXPLAIN`                |
| MySQL      | `EXPLAIN ANALYZE` (8.0.18+)                      | `EXPLAIN FORMAT=JSON`    |
| SQLite     | Measure the query separately                     | `EXPLAIN QUERY PLAN`     |
| SQL Server | Actual execution plan, `SET STATISTICS IO, TIME` | Estimated execution plan |

Investigate these signals:

- Estimated and actual rows differ by an order of magnitude: stale statistics,
  correlated columns, or skewed values. Refresh statistics before rewriting queries.
- A full scan of a large table for a selective predicate: missing index, a
  function or implicit cast on the indexed column, or a leading wildcard.
- Sorts or hashes spilling to disk: missing ordered index or insufficient memory.
- A nested loop executed many times: N+1 access or a poor join order.
- Plans that change with parameter values: parameter-sensitive prepared statements.

Measure with the same parameters, warm and cold cache states stated, several runs,
and production-like data distribution. A plan on a tiny development table rarely
predicts production behavior.

## Isolation and anomalies

Default isolation differs: PostgreSQL and SQL Server use read committed, MySQL
InnoDB uses repeatable read, and SQLite transactions are serializable.

| Anomaly     | Example                                                      | Common prevention                                                      |
| ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Lost update | Two requests read a balance and both write a new value       | Atomic `UPDATE ... SET x = x + ?`, `SELECT ... FOR UPDATE`, or version |
| Write skew  | Two on-call staff each see another on call and both sign off | Serializable isolation, or lock a shared row representing the rule     |
| Phantom     | A count check passes, then a concurrent insert breaks it     | Serializable isolation, a unique constraint, or engine range locks     |

Prefer a constraint when it can express the rule. Retry serialization failures
and deadlocks by rerunning the whole transaction with a bounded attempt count.
