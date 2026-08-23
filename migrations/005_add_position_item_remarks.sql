-- 005_add_position_item_remarks.sql
-- position_item table was missing a remarks column — add_position.php /
-- update_position.php (plantilla_api.php) already insert/update it, but
-- it never existed in the schema.
-- Applied to: local + Railway (shared "railway" database)

ALTER TABLE `position_item`
ADD COLUMN `remarks` text COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `status`;
