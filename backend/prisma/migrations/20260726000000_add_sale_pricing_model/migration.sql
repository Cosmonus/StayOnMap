-- SALE joins RENT and LEASE as a pricing mode: flats, houses, shops and plots
-- can be sold outright, not only let.
--
-- ALONE in its own migration on purpose. PostgreSQL cannot use a newly added
-- enum value in the same transaction that added it, so the columns and the
-- backfill that reference 'SALE' are separate migrations that run after this
-- one (see .claude/database.md's enum gotcha — error P3018).
ALTER TYPE "PricingModel" ADD VALUE IF NOT EXISTS 'SALE';
