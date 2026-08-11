const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testQuery() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT 
        o.*,
        b.name as branch_name,
        b.address as branch_address,
        COALESCE(au.name, o.customer_name) as customer_name,
        au.email as customer_email,
        COALESCE(au.phone, o.customer_phone) as customer_phone,
        ua.address_line1,
        ua.building,
        ua.company_name,
        ua.address_line2,
        ua.city,
        ua.state,
        ua.zip_code,
        ua.latitude,
        ua.longitude,
        rc.title as reward_title,
        rc.description as reward_description,
        rc.code as reward_code
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN auth_users au ON o.user_id = au.id
      LEFT JOIN user_addresses ua ON o.address_id = ua.id
      LEFT JOIN user_rewards ur ON o.applied_user_reward_id = ur.id
      LEFT JOIN rewards_catalog rc ON ur.catalog_id = rc.id
      ORDER BY o.created_at DESC
    `);
    console.log("Returned rows count:", res.rows.length);
    res.rows.forEach(row => {
      console.log("Row:", { id: row.id, customer_name: row.customer_name, customer_phone: row.customer_phone });
    });
  } finally {
    client.release();
    await pool.end();
  }
}

testQuery().catch(console.error);
