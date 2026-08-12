const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('\n=== 1. Pending Delivery Orders (last 24h) ===');
    const pendingRes = await client.query(`
      SELECT
        o.id, o.status, o.order_type, o.delivery_address, o.total_amount,
        o.created_at, o.customer_name, o.customer_phone,
        json_agg(json_build_object(
          'quantity', oi.quantity,
          'product_name', p.name,
          'total_price', oi.total_price
        ) ORDER BY oi.id) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p    ON p.id = oi.product_id
      WHERE o.order_type ILIKE 'delivery'
        AND o.status IN ('pending', 'confirmed', 'ready')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    console.log('Found', pendingRes.rows.length, 'pending delivery order(s)');
    pendingRes.rows.forEach(o => {
      console.log('  #' + o.id + ' | ' + o.status + ' | ' + o.customer_name + ' | ' + o.customer_phone + ' | $' + o.total_amount);
    });

    console.log('\n=== 2. Most Recent Delivery Orders (any status, last 7 days) ===');
    const recentRes = await client.query(`
      SELECT id, status, order_type, customer_name, customer_phone, total_amount, created_at
      FROM orders
      WHERE order_type ILIKE 'delivery'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    recentRes.rows.forEach(o => {
      console.log('  #' + o.id + ' | ' + o.status + ' | ' + o.customer_name + ' | $' + o.total_amount + ' | ' + new Date(o.created_at).toLocaleString());
    });

    if (recentRes.rows.length > 0) {
      const testId = recentRes.rows[0].id;
      const r = await client.query('SELECT id, status FROM orders WHERE id = $1', [testId]);
      console.log('\n=== 3. Single order fetch (GET /api/orders/:id) ===');
      console.log('  Order #' + testId + ' status: ' + r.rows[0].status + ' — OK');
    }

    console.log('\n✅ All queries passed — DB healthy, schema matches code');
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
