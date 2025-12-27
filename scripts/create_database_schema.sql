-- Database Schema for Bot Memecoin Hunter
-- Run this script to create the required tables

-- Table: coins
-- Stores raw coin data discovered by crawler
CREATE TABLE IF NOT EXISTS coins (
  id SERIAL PRIMARY KEY,
  address VARCHAR(100) NOT NULL, -- Support Ethereum (42) and Solana (32-44) addresses
  chain_id INTEGER NOT NULL,
  name VARCHAR(255),
  symbol VARCHAR(50),
  decimals INTEGER,
  total_supply NUMERIC,
  liquidity NUMERIC,
  source VARCHAR(50) DEFAULT 'dexscreener',
  discovered_at TIMESTAMP DEFAULT NOW(),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_coins_address ON coins(address);
CREATE INDEX IF NOT EXISTS idx_coins_chain_id ON coins(chain_id);
CREATE INDEX IF NOT EXISTS idx_coins_discovered_at ON coins(discovered_at);
CREATE INDEX IF NOT EXISTS idx_coins_source ON coins(source);

-- Table: analyses
-- Stores analysis results from analyzer service
CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  price_score INTEGER CHECK (price_score >= 0 AND price_score <= 100),
  volume_score INTEGER CHECK (volume_score >= 0 AND volume_score <= 100),
  social_score INTEGER CHECK (social_score >= 0 AND social_score <= 100),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  metrics JSONB DEFAULT '{}',
  recommendations TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_coin_id ON analyses(coin_id);
CREATE INDEX IF NOT EXISTS idx_analyses_overall_score ON analyses(overall_score);
CREATE INDEX IF NOT EXISTS idx_analyses_analyzed_at ON analyses(analyzed_at);

-- Table: users
-- Stores Telegram user preferences
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- Table: notifications
-- Stores notification history
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  coin_id INTEGER REFERENCES coins(id) ON DELETE CASCADE,
  message_text TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_coin_id ON notifications(coin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);

