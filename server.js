const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

// Manually load .env variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      } else if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value.trim();
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Setup connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});



app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Page Routes
app.get('/admin', (req, res) => {
  const cookiePasscode = req.cookies.admin_passcode;
  const adminPasscode = process.env.ADMIN_PASSCODE;
  
  if (adminPasscode && cookiePasscode === adminPasscode) {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
  } else {
    res.redirect('/login');
  }
});

app.get('/login', (req, res) => {
  const cookiePasscode = req.cookies.admin_passcode;
  const adminPasscode = process.env.ADMIN_PASSCODE;
  
  if (adminPasscode && cookiePasscode === adminPasscode) {
    res.redirect('/admin');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// Authentication check middleware
function requireAuth(req, res, next) {
  const adminPasscode = process.env.ADMIN_PASSCODE;
  if (!adminPasscode) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace('Bearer ', '').trim();
  }

  const customHeader = req.headers['x-admin-passcode'];
  const cookiePasscode = req.cookies['admin_passcode'];

  if (
    token === adminPasscode ||
    (customHeader && customHeader.trim() === adminPasscode) ||
    cookiePasscode === adminPasscode
  ) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}

// API Routes

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL environment variable is not defined.' });
    }
    const result = await pool.query(
      `SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.category, 
        p.unit_price_usd::float as unit_price_usd, 
        p.image_url, 
        p.sort_order, 
        p.created_at 
       FROM ovrload_products p
       LEFT JOIN ovrload_categories c ON LOWER(p.category) = LOWER(c.name)
       ORDER BY COALESCE(c.sort_order, 9999) ASC, p.category ASC, p.sort_order ASC, p.name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Database Connection Error: ' + error.message });
  }
});

// POST /api/products (Admin only)
app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const { name, description, category, unit_price_usd, image_url, sort_order } = req.body;

    if (!name || !category || unit_price_usd === undefined || unit_price_usd === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const price = parseFloat(unit_price_usd);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }

    const sortOrderVal = parseInt(sort_order, 10);
    const sortOrder = isNaN(sortOrderVal) ? 0 : sortOrderVal;

    const result = await pool.query(
      'INSERT INTO ovrload_products (name, description, category, unit_price_usd, image_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, description, category, unit_price_usd::float as unit_price_usd, image_url, sort_order, created_at',
      [name.trim(), description?.trim() || '', category.trim(), price, image_url?.trim() || '', sortOrder]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/products/:id (Admin only)
app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, unit_price_usd, image_url, sort_order } = req.body;

    if (!name || !category || unit_price_usd === undefined || unit_price_usd === null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const price = parseFloat(unit_price_usd);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Invalid price value' });
    }

    const sortOrderVal = parseInt(sort_order, 10);
    const sortOrder = isNaN(sortOrderVal) ? 0 : sortOrderVal;

    const checkProduct = await pool.query('SELECT id FROM ovrload_products WHERE id = $1', [id]);
    if (checkProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const result = await pool.query(
      'UPDATE ovrload_products SET name = $1, description = $2, category = $3, unit_price_usd = $4, image_url = $5, sort_order = $6 WHERE id = $7 RETURNING id, name, description, category, unit_price_usd::float as unit_price_usd, image_url, sort_order, created_at',
      [name.trim(), description?.trim() || '', category.trim(), price, image_url?.trim() || '', sortOrder, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/products/:id (Admin only)
app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const checkProduct = await pool.query('SELECT id FROM ovrload_products WHERE id = $1', [id]);
    if (checkProduct.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await pool.query('DELETE FROM ovrload_products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, sort_order FROM ovrload_categories ORDER BY sort_order ASC, name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/categories (Admin only)
app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const { name, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const sortOrderVal = parseInt(sort_order, 10);
    const sortOrder = isNaN(sortOrderVal) ? 0 : sortOrderVal;

    const result = await pool.query(
      'INSERT INTO ovrload_categories (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order RETURNING name, sort_order',
      [name.trim(), sortOrder]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving category:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/auth
app.post('/api/auth', (req, res) => {
  const { passcode } = req.body;
  const adminPasscode = process.env.ADMIN_PASSCODE;

  if (!adminPasscode) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (passcode === adminPasscode) {
    res.cookie('admin_passcode', passcode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    });
    return res.json({ authenticated: true });
  }

  res.status(401).json({ authenticated: false, error: 'Invalid passcode' });
});

// GET /api/auth
app.get('/api/auth', (req, res) => {
  const adminPasscode = process.env.ADMIN_PASSCODE;
  const cookiePasscode = req.cookies['admin_passcode'];

  if (adminPasscode && cookiePasscode === adminPasscode) {
    return res.json({ authenticated: true });
  }

  res.status(401).json({ authenticated: false });
});

// Handle wildcard routing for frontend pages
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server locally (skip if running as a Vercel serverless function)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
