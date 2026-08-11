import postgres from 'postgres';

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkAppSettingsSchema() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_settings'
    `;
    console.log("app_settings columns:", cols);
  } catch (err) {
    console.error("Error checking columns:", err);
  } finally {
    await sql.end();
  }
}

checkAppSettingsSchema();
