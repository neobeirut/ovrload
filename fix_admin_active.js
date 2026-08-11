const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixAdminActive() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      UPDATE admin_users
      SET is_active = true
      WHERE is_active IS NULL OR is_active = false
    `);
    console.log("Updated admin users is_active count:", res.rowCount);

    const check = await client.query(`SELECT id, name, email, is_active FROM admin_users`);
    console.log("Updated admin users:", check.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAdminActive().catch(console.error);
