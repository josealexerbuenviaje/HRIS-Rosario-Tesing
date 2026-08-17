-- 004_login_history_nullable_user_id.sql
-- Needed so failed login attempts (rate limiting) can be logged even
-- when the email doesn't match any real user — there's no valid
-- user_id to attach in that case.
-- Applied to: Railway (shared "railway" database)

ALTER TABLE `login_history` MODIFY `user_id` int NULL;
