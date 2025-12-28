-- Migration: Create positions table for trading positions
-- This table tracks all trading positions (buy/sell)

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(100) NOT NULL,
  symbol VARCHAR(50),
  chain_id INTEGER NOT NULL DEFAULT 56, -- BSC default
  buy_price_usd NUMERIC(20, 8) NOT NULL,
  current_price_usd NUMERIC(20, 8),
  highest_price_ever NUMERIC(20, 8) NOT NULL DEFAULT 0,
  profit_floor NUMERIC(20, 8),
  amount_token NUMERIC(30, 18) NOT NULL, -- Token amount dengan precision tinggi
  amount_usd_invested NUMERIC(20, 8) NOT NULL DEFAULT 10.0, -- Default $10
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  buy_tx_hash VARCHAR(100),
  sell_tx_hash VARCHAR(100),
  pnl NUMERIC(20, 8), -- Profit/Loss in USD
  pnl_percentage NUMERIC(10, 4), -- Profit/Loss percentage
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  coin_id INTEGER REFERENCES coins(id) ON DELETE SET NULL, -- Link to coins table if exists
  UNIQUE(token_address, chain_id, status) -- One open position per token
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_token_address ON positions(token_address);
CREATE INDEX IF NOT EXISTS idx_positions_chain_id ON positions(chain_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_status_chain ON positions(status, chain_id);
CREATE INDEX IF NOT EXISTS idx_positions_created_at ON positions(created_at);
CREATE INDEX IF NOT EXISTS idx_positions_highest_price ON positions(highest_price_ever);
CREATE INDEX IF NOT EXISTS idx_positions_profit_floor ON positions(profit_floor) WHERE profit_floor IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_positions_updated_at
BEFORE UPDATE ON positions
FOR EACH ROW
EXECUTE FUNCTION update_positions_updated_at();

-- Index untuk query posisi terbuka yang perlu dimonitor
CREATE INDEX IF NOT EXISTS idx_positions_open_monitor ON positions(status, chain_id, updated_at) WHERE status = 'OPEN';

