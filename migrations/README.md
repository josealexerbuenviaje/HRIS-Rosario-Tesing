# Migrations

Numbered `.sql` files, run in order. No tooling — just a convention.

## Rule

Any schema change (new column, new table, index, constraint) gets a
new numbered file here **first**, then gets run on **local**, then on
**Railway**. Never run an ad hoc `ALTER TABLE` directly against
Railway without writing the file first — that's how local and
production silently drift out of sync (see migrations 001–003, all
of which were bugs caused by exactly that).

## Naming

`NNN_short_description.sql` — next number, brief snake_case summary.

## Applying a migration

1. Write the `.sql` file, with a comment explaining *why* the change
   is needed (not just what it does).
2. Run it against your local database first — confirm the app still
   works.
3. Run the exact same file against Railway (via TablePlus or the
   Railway CLI tunnel).
4. Commit the file alongside whatever code change depends on it, in
   the same PR/commit where possible.

## History

| # | File | What it fixed |
|---|---|---|
| 001 | `001_add_parent_dept_id.sql` | `department` table was missing a column the code already referenced |
| 002 | `002_fix_applicants_id.sql` | `applicants.id` had no AUTO_INCREMENT/PRIMARY KEY — every row got id=0 |
| 003 | `003_fix_appointments_id.sql` | Same bug as 002, on `appointments.id` |
| 004 | `004_login_history_nullable_user_id.sql` | Needed to log failed logins for emails with no matching account |
