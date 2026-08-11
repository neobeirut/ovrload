const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkAdminRoles() {
  const client = await pool.connect();
  try {
    const adminUsers = await client.query(`SELECT id, name, email, branch_id, is_active FROM admin_users`);
    console.log("Admin users:", adminUsers.rows);

    const roles = await client.query(`SELECT * FROM admin_user_roles`);
    console.log("Admin user roles:", roles.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAdminRoles().catch(console.error);
