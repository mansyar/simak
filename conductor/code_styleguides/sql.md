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
- **Rollback**: Always include a rollback path for schema changes.

*Source: [SQL Style Guide (General Best Practices)](https://www.sqlstyle.guide/)*
