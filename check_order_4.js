const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT *
      FROM orders
      ORDER BY id DESC
      LIMIT 10
    `);
    console.log('Recent orders in DB:');
    result.rows.forEach(r => console.log(r.id, 'Name:', r.customer_name, 'Phone:', r.customer_phone, 'ScheduledDate:', r.scheduled_date, 'ScheduledTime:', r.scheduled_time));
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(console.error);
