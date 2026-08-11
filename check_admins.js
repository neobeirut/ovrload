const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkAdminSessions() {
  const client = await pool.connect();
  try {
    const admins = await client.query(`SELECT id, name, email, branch_id, is_active FROM admin_users`);
    console.log("Admin Users in DB:", admins.rows);

    const roles = await client.query(`SELECT * FROM admin_user_roles`);
    console.log("Admin User Roles in DB:", roles.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAdminSessions().catch(console.error);
