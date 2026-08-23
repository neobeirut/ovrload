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

    const rows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE '%whatsapp%'`;
    console.log("Settings rows:", rows);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await sql.end();
  }
}

inspectConfig();
