-- 002_fix_applicants_id.sql
-- applicants.id was `int unsigned NOT NULL` with NO AUTO_INCREMENT and
-- NO PRIMARY KEY — every insert defaulted id to 0, so every applicant
-- record ended up sharing the same id.
-- Applied to: Railway (shared "railway" database)

-- Remove existing bad rows stuck at id = 0 before adding the constraint
-- (a primary key requires unique values, so duplicates must go first).
DELETE FROM `applicants` WHERE `id` = 0;

ALTER TABLE `applicants`
MODIFY `id` int unsigned NOT NULL AUTO_INCREMENT,
ADD PRIMARY KEY (`id`);
