import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// Load environment variables (but Docker Compose environment takes precedence)
dotenv.config();

/**
 * PostgreSQL database configuration and connection pool
 * 
 * IMPORTANT: In Docker, environment variables are set by docker-compose.yml
 * and take precedence over .env file. This ensures the correct database name
 * is used even if .env file is missing or incorrect.
 */
const poolConfig: PoolConfig = {
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  // CRITICAL: Use POSTGRES_DB for database name, NOT POSTGRES_USER
  database: process.env.POSTGRES_DB || 'memecoin_hunter',
  user: process.env.POSTGRES_USER || 'memecoin_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Debug logging (remove in production if needed)
if (process.env.NODE_ENV !== 'production') {
  console.log('Database config:', {
    host: poolConfig.host,
    port: poolConfig.port,
    database: poolConfig.database,
    user: poolConfig.user,
    password: poolConfig.password ? '***' : undefined,
  });
}

export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW(), current_database() as db_name');
    console.log(`Database connection successful. Connected to: ${result.rows[0].db_name}`);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Database config used:', {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
        user: poolConfig.user,
      });
    }
    return false;
  }
}
