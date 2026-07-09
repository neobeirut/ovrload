const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Read .env file manually
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);

if (!dbUrlMatch) {
  console.error('DATABASE_URL not found in .env!');
  process.exit(1);
}

const connectionString = dbUrlMatch[1];
console.log('Connecting to PostgreSQL database...');

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  try {
    await client.connect();
    console.log('Connected successfully.');

    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Running schema migration...');
    await client.query(schemaSql);
    console.log('Schema migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
