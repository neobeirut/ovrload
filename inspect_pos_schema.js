import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log("=== TABLE COLUMNS INSPECTION ===");

    const tables = ['orders', 'order_items', 'products', 'categories', 'product_customizations'];

    for (const table of tables) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      console.log(`\n--- ${table} ---`);
      console.table(cols.rows);
    }

    // Check enum or distinct values for order status & source
    const orderStatuses = await pool.query(`SELECT DISTINCT status FROM orders`);
    console.log('\nDistinct Order Statuses:', orderStatuses.rows.map(r => r.status));

    const orderTypes = await pool.query(`SELECT DISTINCT order_type FROM orders`);
    console.log('Distinct Order Types:', orderTypes.rows.map(r => r.order_type));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
