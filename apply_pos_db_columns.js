import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("Adding POS columns to orders table...");
    
    await pool.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS order_source VARCHAR(50) DEFAULT 'POS',
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'Cash',
      ADD COLUMN IF NOT EXISTS void_reason TEXT;
    `);

    console.log("SUCCESS: Added order_source, payment_method, and void_reason columns to orders table.");

    // Also check order_items table for comment column
    await pool.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS comment TEXT;
    `);

    console.log("SUCCESS: Verified comment column in order_items table.");

  } catch (err) {
    console.error("DB Alter error:", err);
  } finally {
    await pool.end();
  }
}

main();
