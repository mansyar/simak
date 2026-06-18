<protect>
# SQL Style Guide Summary

This document outlines best practices for writing clean, readable, and maintainable SQL queries and schema definitions.

## 1. Keywords and Naming

- **Keywords**: Use `UPPERCASE` for all SQL keywords (e.g., `SELECT`, `FROM`, `WHERE`).
- **Identifiers**: Use `snake_case` for all table names, column names, and other identifiers.
- **Singular vs Plural**: Prefer singular table names (e.g., `user` instead of `users`).
- **Reserved Words**: Never use reserved SQL keywords as identifiers.

## 2. Query Structure

- **Formatting**:
  - One major clause per line (`SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `ORDER BY`).
  - Indent subclauses (e.g., inside `WHERE` or `JOIN`) for clarity.
- **Columns**: Explicitly list all columns in `SELECT` statements. Avoid `SELECT *` in production code.
- **Joins**:
  - Use explicit `JOIN` syntax (e.g., `INNER JOIN`, `LEFT JOIN`).
  - Use the `ON` clause for join conditions.
- **Aliases**: Use descriptive aliases for tables, especially in multi-table joins.

## 3. Data Types and Constraints

- **Consistency**: Use consistent data types across the schema.
- **Constraints**:
  - Always define a `PRIMARY KEY`.
  - Use `FOREIGN KEY` constraints to enforce referential integrity.
  - Use `NOT NULL` where appropriate.
  - Use `DEFAULT` values instead of allowing `NULL` where a sensible default exists.

## 4. Performance and Best Practices

- **Indexing**: Create indexes on columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses.
- **Transactions**: Use transactions for multi-step operations to ensure atomicity.
- **Comments**: Use `--` for single-line comments and `/* ... */` for block comments to explain complex logic.

## 5. Migrations

- **Incremental**: Apply schema changes through version-controlled migration files.
- **Idempotent**: Ensure migrations are idempotent where possible (though typically managed by a tool).
- **Rollback**: Always include a rollback path for schema changes (see §5.1 Rollback Convention).

### 5.1 Rollback Convention

Drizzle has no built-in rollback mechanism. Migrations are forward-only. To prepare for emergency manual rollbacks:

- **Companion rollback files**: Every migration MUST have a companion rollback SQL file at `drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql` where `NNNN` + `<tag>` match the forward migration filename.
- **Never auto-applied**: Rollback files are NOT registered in `meta/_journal.json` and are never executed by `migrate.mjs`. They exist solely for documented, dev-tested manual execution via `psql` or `docker exec`.
- **Dev test procedure**:
  1. Apply forward migration: `pnpm db:migrate`
  2. Verify the change is correct
  3. Execute rollback: `psql $DATABASE_URL < drizzle/migrations/rollback/<NNNN>_<tag>.rollback.sql`
  4. Verify the schema has reverted
  5. Re-apply: `pnpm db:migrate` (should succeed cleanly)
- **Irreversible data-loss note**: If a migration causes irreversible data loss, the rollback file MUST contain a comment at the top: `-- ROLLBACK NOT POSSIBLE: data loss irreversible`. The file may be empty or contain only the comment.
- **Soft-delete preferred**: Prefer adding a `deleted_at` timestamp column over hard `DROP COLUMN` operations. Soft-deletes preserve data and are always reversible.

### 5.2 Expand-Contract Pattern

Destructive schema changes MUST be split across multiple deploys so that old application code and the new schema coexist during rollout. This prevents downtime and data corruption.

**Prohibited in a single deploy:**

- `DROP COLUMN` while old code still reads it
- `RENAME COLUMN` while old code uses the old name
- `ALTER COLUMN TYPE` while old code expects the old type
- `SET NOT NULL` on an existing column without backfilling all rows first

**Canonical 4-step column rename:**

1. **Expand**: Add the new column (`ALTER TABLE ... ADD COLUMN new_col ...`)
2. **Migrate/Backfill**: Deploy code that writes to both columns; backfill existing rows
3. **Flip**: Deploy code that reads from the new column exclusively
4. **Contract**: Drop the old column (`ALTER TABLE ... DROP COLUMN old_col`)

**Dangerous operations and safe alternatives:**

| Operation           | Lock Type               | Safe Approach                                                                                 |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `SET NOT NULL`      | `ACCESS EXCLUSIVE`      | Add `CHECK (col IS NOT NULL) NOT VALID` → `VALIDATE CONSTRAINT` → `SET NOT NULL` → drop CHECK |
| `ALTER COLUMN TYPE` | `ACCESS EXCLUSIVE`      | Add new column → backfill → flip code → drop old column                                       |
| `CREATE INDEX`      | `SHARE` (blocks writes) | Use `CREATE INDEX CONCURRENTLY` outside a transaction                                         |

**`CREATE INDEX CONCURRENTLY` caveat:** This command fails inside Drizzle's default transaction-wrapped migrations. When first needed, split it into a separate migration file and add `disableTransactions: true` to `drizzle.config.ts`.

**Safe `SET NOT NULL` pattern:**

```sql
ALTER TABLE t ADD CONSTRAINT t_col_nn CHECK (col IS NOT NULL) NOT VALID;
ALTER TABLE t VALIDATE CONSTRAINT t_col_nn;
ALTER TABLE t ALTER COLUMN col SET NOT NULL;
ALTER TABLE t DROP CONSTRAINT t_col_nn;
```

**When to use a maintenance window:**

- Dropping a heavily-used column (blocks all reads during `DROP`)
- `ALTER COLUMN TYPE` on millions of rows (long `ACCESS EXCLUSIVE` lock)
- Any operation that cannot be safely split across deploys

_Source: [SQL Style Guide (General Best Practices)](https://www.sqlstyle.guide/)_

</protect>
