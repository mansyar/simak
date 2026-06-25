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

## 6. Transaction Wrapping

When writing server handlers that perform two or more database writes, the writes MUST be executed inside a single `db.transaction` so that a failure in any step rolls back every change in the unit of work.

### 6.1 When to use `db.transaction`

- **Always wrap** handlers that perform two or more writes (INSERT, UPDATE, DELETE).
- **Do not wrap** single-read or single-write handlers purely for stylistic reasons; extra transactions add overhead.
- **Prefer read-only queries outside the transaction** when they are only needed for authorization or validation, unless the read result must remain stable for the lifetime of the transaction.

### 6.2 Transaction handle usage

Use the transaction handle (`tx`) for every query inside the transaction. Do not mix the outer `db` instance with `tx` inside the callback; doing so may run queries outside the transaction and break atomicity.

```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values({ ... });
  await tx.insert(verification).values({ ... });
});
```

### 6.3 Obtaining inserted IDs

Use `.returning({ id: table.id })` (or another column list) to capture generated IDs inside the transaction. Never rely on a separate `SELECT` after the INSERT inside the same transaction if you can avoid it, and never use a client-generated placeholder as the inserted record identity.

```typescript
const [inserted] = await tx
  .insert(submissions)
  .values({ ... })
  .returning({ id: submissions.id });
```

### 6.4 Post-commit advisory work

Work that is not required for the consistency of the write — e.g., audit logs, notification emails, external API calls — MUST run **after** the transaction commits. Wrap it in a `try/catch` so that a failure in advisory work never surfaces an error for a transaction that already committed or misleads the user into thinking the write failed.

```typescript
try {
  await db.transaction(async (tx) => {
    // ... core writes ...
  });

  // After the transaction commits
  try {
    await logAuditEvent({ ... });
  } catch (auditErr) {
    console.error('Audit log failed after successful transaction:', auditErr);
  }
} catch (err) {
  return serverError(ErrorCode.INTERNAL, 'Internal Server Error', { cause: ... });
}
```

### 6.5 Gold-standard reference

See `src/server/reviews.server.ts` — `submitReviewHandler` for the canonical implementation: authorisation reads outside the transaction, all writes inside the transaction, inserted IDs captured via `.returning()`, and audit logging dispatched after the transaction commits with isolated error handling.

_Source: [SQL Style Guide (General Best Practices)](https://www.sqlstyle.guide/)_

</protect>
