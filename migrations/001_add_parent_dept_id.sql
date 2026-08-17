-- 001_add_parent_dept_id.sql
-- department table was missing parent_dept_id — code referenced it
-- (create_department.php / update_department.php) but it never existed.
-- Applied to: local + Railway (shared "railway" database)

ALTER TABLE `department`
ADD COLUMN `parent_dept_id` varchar(10) COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `dept_id`;
