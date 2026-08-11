import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const custRes = await pool.query(`
      SELECT 
        pc.id, 
        pc.product_id, 
        p.name as product_name,
        pc.ingredient, 
        pc.customization_type, 
        pc.price, 
        ci.option_group_name, 
        ci.is_required, 
        ci.is_multi_select
      FROM product_customizations pc
      LEFT JOIN products p ON pc.product_id = p.id
      LEFT JOIN customization_items ci ON pc.customization_item_id = ci.id
      WHERE pc.is_active = true
      ORDER BY pc.product_id, ci.option_group_name
      LIMIT 25
    `);

    console.log("Sample Customizations from DB:");
    console.table(custRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
