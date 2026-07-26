-- Plots listed before SALE existed carry saleOrLease='SALE' but the default
-- pricingModel='RENT'. Left alone they would be excluded from every Buy search
-- and priced "/mo" on the map — the feature would look broken on exactly the
-- listings it was built for.
--
-- Runs after 20260726000000 because it uses the 'SALE' enum value.
UPDATE "Property" SET "pricingModel" = 'SALE'
WHERE "type" = 'LAND' AND "saleOrLease" = 'SALE' AND "pricingModel" = 'RENT';

-- The mirror case: a plot offered on lease.
UPDATE "Property" SET "pricingModel" = 'LEASE'
WHERE "type" = 'LAND' AND "saleOrLease" = 'LEASE' AND "pricingModel" = 'RENT';
