-- Migration 1 of 2: Add new enum types and new enum values
-- Must be separate from column/table changes (PostgreSQL enum gotcha)

-- New enum: FacingDirection
CREATE TYPE "FacingDirection" AS ENUM ('EAST', 'WEST', 'NORTH', 'SOUTH');

-- New enum: ListingVisibility
CREATE TYPE "ListingVisibility" AS ENUM ('PUBLIC', 'LOGGED_IN', 'HIDDEN');

-- Add MESSAGE value to existing NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MESSAGE';
