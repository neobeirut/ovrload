const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkBranchIds() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, branch_id, customer_name, customer_phone, created_at
      FROM orders
      ORDER BY id DESC
    `);
    console.log("Orders branch_id list:");
    res.rows.forEach(r => console.log(`Order #${r.id}: branch_id = ${r.branch_id} (${typeof r.branch_id}) | Customer: ${r.customer_name}`));
    
    const adminUsers = await client.query(`
      SELECT id, name, email, branch_id, roles
      FROM admin_users
    `);
    console.log("\nAdmin users list:");
    adminUsers.rows.forEach(a => console.log(`Admin #${a.id}: ${a.name} (${a.email}) | branch_id = ${a.branch_id} (${typeof a.branch_id}) | roles = ${JSON.stringify(a.roles)}`));
  } finally {
    client.release();
    await pool.end();
  }
}

checkBranchIds().catch(console.error);
