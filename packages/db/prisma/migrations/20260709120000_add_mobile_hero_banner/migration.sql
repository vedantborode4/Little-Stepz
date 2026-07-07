-- Add MOBILE_HERO to the BannerPosition enum (tall mobile-only hero banner).
ALTER TYPE "BannerPosition" ADD VALUE IF NOT EXISTS 'MOBILE_HERO';
