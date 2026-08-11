const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, customer_name, customer_phone, delivery_address, special_instructions, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('Last 5 orders:');
    result.rows.forEach(r => console.log(JSON.stringify(r, null, 2)));
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
