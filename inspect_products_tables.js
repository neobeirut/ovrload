import pg from 'pg';
const { Pool } = pg;

const connectionString = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const categoriesRes = await pool.query(`SELECT id, name FROM categories ORDER BY id`);
    console.log('\n--- ALL CATEGORIES ---');
    console.table(categoriesRes.rows);

    const prodRes = await pool.query(`
      SELECT p.id, p.name, c.name as category_name, p.price, p.status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id
    `);
    console.log('\n--- ALL PRODUCTS ---');
    console.table(prodRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
