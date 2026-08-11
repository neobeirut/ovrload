import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    console.log('Columns in products table:');
    console.table(columnsRes.rows);

    const countRes = await pool.query(`SELECT COUNT(*) FROM products`);
    console.log('Total products count in DB:', countRes.rows[0].count);

    const ovrloadRes = await pool.query(`
      SELECT p.id, p.name, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE c.name LIKE '%OVRLOAD%' OR c.name IN ('Milkshakes', 'Sides', 'Dips', 'Sweet Loads', 'Drinks')
    `);
    console.log('\nOvrload categories products count:', ovrloadRes.rows.length);
    console.table(ovrloadRes.rows.slice(0, 10));

    // Check if there is a brand_id or is_ovrload column or something in products/categories
    const categoryCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
    `);
    console.log('\nColumns in categories table:');
    console.table(categoryCols.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
