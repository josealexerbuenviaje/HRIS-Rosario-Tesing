-- 003_fix_appointments_id.sql
-- Same bug as applicants.id (migration 002) — appointments.id was
-- `int unsigned NOT NULL` with no AUTO_INCREMENT and no PRIMARY KEY.
-- Applied to: Railway (shared "railway" database)

DELETE FROM `appointments` WHERE `id` = 0;

ALTER TABLE `appointments`
MODIFY `id` int unsigned NOT NULL AUTO_INCREMENT,
ADD PRIMARY KEY (`id`);
