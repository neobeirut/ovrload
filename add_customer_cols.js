const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // Check if columns already exist
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name IN ('customer_name', 'customer_phone')
    `);
    const existing = check.rows.map(r => r.column_name);
    console.log('Existing extra cols:', existing);

    if (!existing.includes('customer_name')) {
      await client.query(`ALTER TABLE orders ADD COLUMN customer_name TEXT`);
      console.log('Added customer_name column');
    }
    if (!existing.includes('customer_phone')) {
      await client.query(`ALTER TABLE orders ADD COLUMN customer_phone TEXT`);
      console.log('Added customer_phone column');
    }
    console.log('Done.');
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
