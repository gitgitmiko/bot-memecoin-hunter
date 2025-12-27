# PHASE 3 – APPLICATION ARCHITECTURE

Dokumentasi lengkap arsitektur aplikasi Bot Memecoin Hunter dengan Node.js + TypeScript.

## 📋 Table of Contents

1. [Folder Structure](#folder-structure)
2. [Service Responsibilities](#service-responsibilities)
3. [Data Flow Diagram](#data-flow-diagram)
4. [Communication Between Services](#communication-between-services)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)

---

## 🗂️ Folder Structure

```
bot-memecoin-hunter/
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
│
├── services/
│   ├── crawler/
│   │   ├── src/
│   │   │   ├── index.ts                    # Entry point
│   │   │   ├── config/
│   │   │   │   ├── database.ts             # PostgreSQL connection
│   │   │   │   ├── redis.ts                # Redis connection
│   │   │   │   └── logger.ts               # Winston logger config
│   │   │   ├── crawlers/
│   │   │   │   ├── base-crawler.ts         # Base crawler abstract class
│   │   │   │   ├── dex-crawler.ts          # DEX (Uniswap, PancakeSwap) crawler
│   │   │   │   ├── twitter-crawler.ts      # Twitter/X crawler
│   │   │   │   └── telegram-crawler.ts     # Telegram channel crawler
│   │   │   ├── models/
│   │   │   │   ├── coin.model.ts           # Coin data model
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── storage.service.ts      # Database storage service
│   │   │   │   ├── queue.service.ts        # Redis queue service
│   │   │   │   └── notification.service.ts # Notification service
│   │   │   ├── utils/
│   │   │   │   ├── validators.ts           # Data validation
│   │   │   │   └── helpers.ts              # Helper functions
│   │   │   └── types/
│   │   │       └── index.ts                # TypeScript types
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   └── healthcheck.js
│   │
│   ├── analyzer/
│   │   ├── src/
│   │   │   ├── index.ts                    # Entry point
│   │   │   ├── config/
│   │   │   │   ├── database.ts
│   │   │   │   ├── redis.ts
│   │   │   │   └── logger.ts
│   │   │   ├── analyzers/
│   │   │   │   ├── base-analyzer.ts        # Base analyzer abstract class
│   │   │   │   ├── price-analyzer.ts       # Price trend analysis
│   │   │   │   ├── volume-analyzer.ts      # Trading volume analysis
│   │   │   │   ├── social-analyzer.ts      # Social media sentiment
│   │   │   │   └── risk-analyzer.ts        # Risk assessment
│   │   │   ├── models/
│   │   │   │   ├── analysis.model.ts       # Analysis result model
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   ├── scoring.service.ts      # Scoring algorithm
│   │   │   │   ├── storage.service.ts      # Database storage
│   │   │   │   └── queue.service.ts        # Redis queue
│   │   │   ├── utils/
│   │   │   │   └── calculations.ts         # Analysis calculations
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   └── healthcheck.js
│   │
│   ├── telegram-bot/
│   │   ├── src/
│   │   │   ├── index.ts                    # Entry point
│   │   │   ├── config/
│   │   │   │   ├── database.ts
│   │   │   │   ├── redis.ts
│   │   │   │   ├── bot.ts                  # Telegram bot config
│   │   │   │   └── logger.ts
│   │   │   ├── handlers/
│   │   │   │   ├── commands/
│   │   │   │   │   ├── start.command.ts    # /start command
│   │   │   │   │   ├── stats.command.ts    # /stats command
│   │   │   │   │   ├── list.command.ts     # /list command
│   │   │   │   │   ├── search.command.ts   # /search command
│   │   │   │   │   └── settings.command.ts # /settings command
│   │   │   │   ├── messages/
│   │   │   │   │   └── text.handler.ts     # Text message handler
│   │   │   │   └── callbacks/
│   │   │   │       └── button.handler.ts   # Button callback handler
│   │   │   ├── services/
│   │   │   │   ├── notification.service.ts # Send notifications
│   │   │   │   ├── data.service.ts         # Fetch data from DB
│   │   │   │   └── queue.service.ts        # Redis queue listener
│   │   │   ├── utils/
│   │   │   │   ├── formatters.ts           # Message formatting
│   │   │   │   └── validators.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   └── healthcheck.js
│   │
│   └── shared/                              # Shared code between services
│       ├── types/
│       │   ├── coin.types.ts                # Coin related types
│       │   ├── analysis.types.ts            # Analysis related types
│       │   └── index.ts
│       └── utils/
│           ├── constants.ts                 # Shared constants
│           └── helpers.ts                   # Shared helpers
│
├── docs/
│   ├── PHASE3_APPLICATION_ARCHITECTURE.md
│   └── ...
│
└── scripts/
    ├── phase1_setup.sh
    ├── phase2_setup.sh
    └── ...
```

---

## 🎯 Service Responsibilities

### 1. Crawler Service

**Primary Responsibility**: Discover and collect meme coin data from various sources

**Functions**:
- ✅ Crawl DEX platforms (Uniswap, PancakeSwap, etc.) for new token listings
- ✅ Monitor Twitter/X for meme coin mentions and trends
- ✅ Scan Telegram channels for coin promotions
- ✅ Extract and validate coin data (address, name, symbol, liquidity, etc.)
- ✅ Store raw coin data to PostgreSQL
- ✅ Publish new coin events to Redis queue for analyzer

**Input Sources**:
- DEX APIs (Uniswap V2/V3, PancakeSwap, etc.)
- Twitter/X API
- Telegram channels
- Blockchain RPC nodes

**Output**:
- Raw coin data stored in PostgreSQL
- Events published to Redis queue: `crawler:new-coin`

**Dependencies**:
- PostgreSQL (storage)
- Redis (message queue)

---

### 2. Analyzer Service

**Primary Responsibility**: Analyze coin data and calculate risk scores

**Functions**:
- ✅ Subscribe to Redis queue for new coin events
- ✅ Fetch coin data from PostgreSQL
- ✅ Analyze price trends and volatility
- ✅ Calculate trading volume metrics
- ✅ Analyze social media sentiment
- ✅ Assess risk factors (rug pull indicators, liquidity, etc.)
- ✅ Calculate overall opportunity score
- ✅ Store analysis results to PostgreSQL
- ✅ Publish high-score coins to Redis queue for notifications

**Input Sources**:
- Redis queue: `crawler:new-coin`
- PostgreSQL (coin data)
- External APIs (price, volume data)

**Output**:
- Analysis results stored in PostgreSQL
- Events published to Redis queue: `analyzer:high-score-coin`

**Analysis Algorithms**:
- Price Trend Analysis (moving averages, momentum)
- Volume Analysis (volume spikes, liquidity depth)
- Social Sentiment Analysis (Twitter mentions, engagement)
- Risk Assessment (contract security, liquidity lock, etc.)
- Opportunity Scoring (weighted combination of factors)

**Dependencies**:
- PostgreSQL (data source & storage)
- Redis (message queue)
- External APIs (price, volume data)

---

### 3. Telegram Bot Service

**Primary Responsibility**: User interface and notifications via Telegram

**Functions**:
- ✅ Handle user commands (/start, /stats, /list, /search, etc.)
- ✅ Subscribe to Redis queue for high-score coin notifications
- ✅ Format and send notifications to users
- ✅ Provide coin details and analysis on demand
- ✅ Manage user preferences and settings
- ✅ Display statistics and reports

**Commands**:
- `/start` - Welcome message and bot introduction
- `/stats` - Show overall statistics
- `/list [limit]` - List top coins by score
- `/search <query>` - Search for specific coin
- `/coin <address>` - Get detailed coin information
- `/settings` - Manage user preferences
- `/help` - Show help message

**Input Sources**:
- Redis queue: `analyzer:high-score-coin`
- PostgreSQL (coin data, analysis results)
- User commands via Telegram

**Output**:
- Formatted messages sent to Telegram users
- Interactive inline keyboards and buttons

**Dependencies**:
- PostgreSQL (data source)
- Redis (message queue)
- Telegram Bot API

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                        │
├─────────────────────────────────────────────────────────────────┤
│  DEX APIs    Twitter API    Telegram    Blockchain RPC         │
└──────────┬──────────┬──────────┬──────────┬─────────────────────┘
           │          │          │          │
           └──────────┴──────────┴──────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   CRAWLER SERVICE      │
         │                        │
         │  - Crawl DEX listings  │
         │  - Monitor social media│
         │  - Extract coin data   │
         │  - Validate data       │
         └───────────┬────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼                        ▼
┌────────────────┐      ┌──────────────────┐
│  PostgreSQL    │      │   Redis Queue    │
│                │      │                  │
│  - coins       │      │ crawler:new-coin │
│  - raw_data    │      │                  │
└────────────────┘      └────────┬─────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  ANALYZER SERVICE      │
                    │                        │
                    │  - Price analysis      │
                    │  - Volume analysis     │
                    │  - Social sentiment    │
                    │  - Risk assessment     │
                    │  - Calculate scores    │
                    └───────────┬────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
                    ▼                        ▼
         ┌──────────────────┐    ┌──────────────────┐
         │  PostgreSQL      │    │   Redis Queue    │
         │                  │    │                  │
         │  - analyses      │    │ analyzer:high-   │
         │  - scores        │    │ score-coin       │
         │  - metrics       │    │                  │
         └──────────────────┘    └────────┬─────────┘
                                          │
                                          ▼
                            ┌────────────────────────┐
                            │  TELEGRAM BOT SERVICE  │
                            │                        │
                            │  - Listen to queue     │
                            │  - Format messages     │
                            │  - Send notifications  │
                            │  - Handle commands     │
                            └───────────┬────────────┘
                                        │
                                        ▼
                            ┌────────────────────────┐
                            │   TELEGRAM USERS       │
                            │                        │
                            │  - Receive alerts      │
                            │  - Query coin data     │
                            │  - View statistics     │
                            └────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                         N8N WORKFLOWS                           │
│  (Phase 4 - Optional automation and integrations)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Communication Between Services

### 1. Crawler → Analyzer

**Method**: Redis Pub/Sub Queue

**Event**: `crawler:new-coin`

**Message Format**:
```typescript
{
  event: 'crawler:new-coin',
  timestamp: '2025-12-26T20:00:00Z',
  data: {
    coinAddress: '0x1234...',
    chainId: 1,
    source: 'dex|twitter|telegram',
    rawData: { ... }
  }
}
```

**Flow**:
1. Crawler discovers new coin
2. Crawler validates and stores to PostgreSQL
3. Crawler publishes event to Redis queue
4. Analyzer subscribes and receives event
5. Analyzer fetches coin data from PostgreSQL
6. Analyzer performs analysis

---

### 2. Analyzer → Telegram Bot

**Method**: Redis Pub/Sub Queue

**Event**: `analyzer:high-score-coin`

**Message Format**:
```typescript
{
  event: 'analyzer:high-score-coin',
  timestamp: '2025-12-26T20:05:00Z',
  data: {
    coinAddress: '0x1234...',
    score: 85,
    analysis: {
      priceScore: 80,
      volumeScore: 90,
      socialScore: 75,
      riskScore: 20
    },
    recommendations: ['high-volume', 'trending']
  }
}
```

**Flow**:
1. Analyzer completes analysis
2. Analyzer calculates final score
3. If score > threshold, publish to Redis queue
4. Telegram bot subscribes and receives event
5. Bot formats message and sends to users

---

### 3. Direct Database Access

**All Services ↔ PostgreSQL**

**Purpose**: Read/write persistent data

**Tables**:
- `coins` - Raw coin data
- `analyses` - Analysis results
- `scores` - Calculated scores
- `notifications` - Notification history
- `users` - Telegram user preferences

---

### 4. Service Health Checks

**Method**: HTTP Health Check Endpoints (internal)

**Endpoints**:
- Crawler: `http://localhost:3001/health`
- Analyzer: `http://localhost:3002/health`
- Telegram Bot: `http://localhost:3003/health`

**Response Format**:
```typescript
{
  status: 'healthy' | 'unhealthy',
  timestamp: '2025-12-26T20:00:00Z',
  checks: {
    database: 'connected' | 'disconnected',
    redis: 'connected' | 'disconnected',
    // service-specific checks
  }
}
```

---

## 🛠️ Technology Stack

### Runtime & Language
- **Node.js**: v20 LTS
- **TypeScript**: v5.x
- **Package Manager**: npm

### Database
- **PostgreSQL**: v15 (primary database)
- **Redis**: v7 (message queue & cache)

### Libraries & Frameworks

#### Common
- `dotenv` - Environment variables
- `winston` - Logging
- `pg` - PostgreSQL client
- `redis` - Redis client
- `axios` - HTTP client

#### Crawler Specific
- `ethers.js` / `web3.js` - Blockchain interaction
- `twitter-api-v2` - Twitter/X API
- `node-telegram-bot-api` - Telegram API (for monitoring)

#### Analyzer Specific
- `mathjs` - Mathematical calculations
- `lodash` - Utility functions

#### Telegram Bot Specific
- `node-telegram-bot-api` - Telegram Bot API
- `telegraf` - Alternative Telegram framework (optional)

---

## 🗄️ Database Schema (Overview)

### Table: `coins`

Stores raw coin data discovered by crawler.

```sql
CREATE TABLE coins (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  name VARCHAR(255),
  symbol VARCHAR(50),
  decimals INTEGER,
  total_supply NUMERIC,
  liquidity NUMERIC,
  source VARCHAR(50), -- 'dex', 'twitter', 'telegram'
  discovered_at TIMESTAMP DEFAULT NOW(),
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coins_address ON coins(address);
CREATE INDEX idx_coins_chain_id ON coins(chain_id);
CREATE INDEX idx_coins_discovered_at ON coins(discovered_at);
```

### Table: `analyses`

Stores analysis results from analyzer service.

```sql
CREATE TABLE analyses (
  id SERIAL PRIMARY KEY,
  coin_id INTEGER REFERENCES coins(id),
  analyzed_at TIMESTAMP DEFAULT NOW(),
  price_score INTEGER,
  volume_score INTEGER,
  social_score INTEGER,
  risk_score INTEGER,
  overall_score INTEGER,
  metrics JSONB,
  recommendations TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analyses_coin_id ON analyses(coin_id);
CREATE INDEX idx_analyses_overall_score ON analyses(overall_score);
CREATE INDEX idx_analyses_analyzed_at ON analyses(analyzed_at);
```

### Table: `users`

Stores Telegram user preferences.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

*(Detailed schema akan dibuat di implementasi Phase 3)*

---

## 🔐 Environment Variables

### Crawler Service
```env
NODE_ENV=production
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=***
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=***
CRAWLER_INTERVAL=300000
LOG_LEVEL=info
```

### Analyzer Service
```env
NODE_ENV=production
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=***
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=***
ANALYZER_INTERVAL=60000
SCORE_THRESHOLD=70
LOG_LEVEL=info
```

### Telegram Bot Service
```env
NODE_ENV=production
TELEGRAM_BOT_TOKEN=***
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=memecoin_hunter
POSTGRES_USER=memecoin_user
POSTGRES_PASSWORD=***
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=***
LOG_LEVEL=info
```

---

## 📝 Next Steps

Setelah Phase 3 selesai, lanjutkan ke:
- **Phase 4**: Automation & Workflows - Setup n8n workflows
- **Phase 5**: Deployment & Optimization - Monitoring dan optimization

---

**Status**: ✅ Phase 3 Architecture Defined
**Last Updated**: $(date)

