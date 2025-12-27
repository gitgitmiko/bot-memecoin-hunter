-- Migration script to support Solana addresses (up to 44 characters)
-- Run this to update the address column length

-- Update coins table address column
ALTER TABLE coins ALTER COLUMN address TYPE VARCHAR(100);

-- Note: Solana addresses can be 32-44 characters
-- Ethereum addresses are 42 characters (0x + 40 hex)
-- Using VARCHAR(100) to provide buffer for future chains

