import postgres from 'postgres';

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function inspectConfig() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log("Database tables:", tables.map(t => t.table_name));

    // Check if system_settings or admin_settings exists
    const settingsExists = tables.some(t => t.table_name === 'system_settings' || t.table_name === 'settings');
    console.log("Settings table exists:", settingsExists);

    if (settingsExists) {
      const rows = await sql`SELECT * FROM system_settings LIMIT 10`;
      console.log("Settings rows:", rows);
    }
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await sql.end();
  }
}

inspectConfig();
