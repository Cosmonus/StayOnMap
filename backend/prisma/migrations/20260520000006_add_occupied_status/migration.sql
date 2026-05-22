-- Migration 1: Add OCCUPIED value to PropertyStatus enum
-- Must be separate from the column changes below (PostgreSQL enum gotcha)
ALTER TYPE "PropertyStatus" ADD VALUE IF NOT EXISTS 'OCCUPIED';
