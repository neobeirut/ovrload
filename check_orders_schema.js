const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    // Get orders table columns
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    console.log('Orders table columns:');
    res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

    // Try the pending-delivery query
    const orders = await client.query(`
      SELECT o.id, o.status, o.order_type, o.delivery_address, o.total_amount, o.created_at
      FROM orders o
      WHERE o.order_type ILIKE 'delivery'
        AND o.status IN ('pending', 'confirmed', 'ready')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      LIMIT 5
    `);
    console.log('\nPending delivery orders:', orders.rows.length);
    console.log(orders.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
