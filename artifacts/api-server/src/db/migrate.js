import { pool } from "./index.js";
import { logger } from "../lib/logger.js";

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _trading_users (
        id SERIAL PRIMARY KEY,
        clerk_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        balance DECIMAL(18,8) NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        trading_balance DECIMAL(18,2) DEFAULT 50,
        total_trades INTEGER NOT NULL DEFAULT 0,
        trades_since_last_share INTEGER NOT NULL DEFAULT 0,
        tp_signals_since_last_share INTEGER NOT NULL DEFAULT 0,
        total_profit DECIMAL(18,8) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        alpaca_account_id VARCHAR(255),
        alpaca_account_number VARCHAR(100),
        alpaca_options_level INTEGER,
        auto_trade_enabled BOOLEAN NOT NULL DEFAULT false,
        scan_enabled BOOLEAN NOT NULL DEFAULT false,
        scan_interval_minutes INTEGER NOT NULL DEFAULT 15,
        scan_session_filter VARCHAR(30) NOT NULL DEFAULT 'major',
        last_scanned_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _trading_trades (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES _trading_users(id),
        symbol VARCHAR(50) NOT NULL,
        type VARCHAR(10) NOT NULL,
        entry_price DECIMAL(18,8),
        stop_loss DECIMAL(18,8),
        take_profit DECIMAL(18,8),
        stop_loss_pips DECIMAL(10,2),
        take_profit_pips DECIMAL(10,2),
        risk_reward_ratio VARCHAR(20),
        recommended_lot_size DECIMAL(10,4),
        risk_percent DECIMAL(5,2),
        account_balance_at_signal DECIMAL(18,2),
        signal_status VARCHAR(20) NOT NULL DEFAULT 'active',
        journal_note TEXT,
        ai_reasoning TEXT,
        ai_confidence DECIMAL(5,2),
        forecast TEXT,
        key_levels TEXT,
        forecast_data JSONB,
        share_settled BOOLEAN NOT NULL DEFAULT false,
        mt5_ticket_id VARCHAR(100),
        alpaca_order_id VARCHAR(100),
        option_symbol VARCHAR(30),
        option_type VARCHAR(10),
        option_strike DECIMAL(18,4),
        option_expiration TIMESTAMP,
        option_premium DECIMAL(18,4),
        timeframe VARCHAR(10),
        session VARCHAR(20),
        confluence_score INTEGER,
        closed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _trading_deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES _trading_users(id),
        amount DECIMAL(18,8) NOT NULL,
        currency VARCHAR(10) NOT NULL,
        amount_usd DECIMAL(18,8),
        type VARCHAR(30) NOT NULL DEFAULT 'deposit',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        flutterwave_tx_ref VARCHAR(255),
        flutterwave_tx_id VARCHAR(255),
        note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _trading_watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES _trading_users(id),
        symbol VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, symbol)
      );
    `);

    const alterStatements = [
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS trading_balance DECIMAL(18,2) DEFAULT 50`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS tp_signals_since_last_share INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS trades_since_last_share INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS total_profit DECIMAL(18,8) NOT NULL DEFAULT 0`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS alpaca_account_id VARCHAR(255)`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS alpaca_account_number VARCHAR(100)`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS alpaca_options_level INTEGER`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS auto_trade_enabled BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS scan_enabled BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS scan_interval_minutes INTEGER NOT NULL DEFAULT 15`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS scan_session_filter VARCHAR(30) NOT NULL DEFAULT 'major'`,
      `ALTER TABLE _trading_users ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMP`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS entry_price DECIMAL(18,8)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(18,8)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS take_profit DECIMAL(18,8)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS stop_loss_pips DECIMAL(10,2)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS take_profit_pips DECIMAL(10,2)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS risk_reward_ratio VARCHAR(20)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS recommended_lot_size DECIMAL(10,4)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS risk_percent DECIMAL(5,2)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS account_balance_at_signal DECIMAL(18,2)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS signal_status VARCHAR(20) NOT NULL DEFAULT 'active'`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS journal_note TEXT`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS forecast TEXT`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS key_levels TEXT`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS mt5_ticket_id VARCHAR(100)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS session VARCHAR(20)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS confluence_score INTEGER`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS alpaca_order_id VARCHAR(100)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS option_symbol VARCHAR(30)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS option_type VARCHAR(10)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS option_strike DECIMAL(18,4)`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS option_expiration TIMESTAMP`,
      `ALTER TABLE _trading_trades ADD COLUMN IF NOT EXISTS option_premium DECIMAL(18,4)`,
    ];

    for (const stmt of alterStatements) {
      try {
        await client.query(stmt);
      } catch (e) {
        if (!e.message.includes("already exists") && !e.message.includes("duplicate column")) {
          logger.warn({ msg: e.message }, "Migration warning");
        }
      }
    }

    logger.info("Database migrations complete");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  } finally {
    client.release();
  }
}
