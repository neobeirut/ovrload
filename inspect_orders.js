const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%order%' OR table_name ILIKE '%item%' OR table_name ILIKE '%customer%') ORDER BY table_name"
  );
  console.log('Tables:', tables.rows.map(r => r.table_name).join(', '));
  for (const row of tables.rows) {
    const cols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [row.table_name]
    );
    console.log('\n' + row.table_name + ':');
    cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ')'));
  }
  client.release();
  await pool.end();
}
run().catch(console.error);
