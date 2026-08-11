import postgres from 'postgres';

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";
const sql = postgres(connectionString);

async function seedSettings() {
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS app_settings_setting_key_idx ON app_settings (setting_key)
    `;

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
      VALUES 
        ('toters_discount_percent', '15', NOW(), NOW()),
        ('noknok_discount_percent', '15', NOW(), NOW())
      ON CONFLICT (setting_key) 
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
    `;
    console.log("Seeded app_settings successfully!");

    const rows = await sql`SELECT * FROM app_settings`;
    console.log("Current app_settings:", rows);
  } catch (err) {
    console.error("Error seeding app_settings:", err);
  } finally {
    await sql.end();
  }
}

seedSettings();
