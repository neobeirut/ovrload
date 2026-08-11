import postgres from 'postgres';

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function checkAppSettings() {
  try {
    const rows = await sql`SELECT * FROM app_settings`;
    console.log("app_settings rows:", rows);
  } catch (err) {
    console.error("Error checking app_settings:", err);
  } finally {
    await sql.end();
  }
}

checkAppSettings();
