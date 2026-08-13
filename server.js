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
app.set('case sensitive routing', false);
const PORT = process.env.PORT || 3000;

const SUPABASE_DB_URL = "postgresql://postgres.nigtjaiwnmjdnmjtdlof:FsDdHJhoYDv1GsxW@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

// Setup connection pool - always force Ovrload Supabase database URL
const pool = new Pool({
  connectionString: SUPABASE_DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});



app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Driver PWA ────────────────────────────────────────────────

// PWA Icons (SVG — Chrome 93+ supports SVG in manifest)
app.get('/driver-icon.svg', (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="100" fill="#0a0a0a"/>
    <rect x="20" y="20" width="472" height="472" rx="80" fill="#e66e19"/>
    <text x="256" y="320" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="260" fill="#fff">🛵</text>
  </svg>`);
});

// Manifest for PWA installability
app.get('/driver-manifest.json', (req, res) => {
  res.json({
    name: 'OVR LOAD — Driver',
    short_name: 'Driver',
    description: 'OVR LOAD Driver Dispatch App',
    start_url: '/driver',
    scope: '/driver',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#e66e19',
    orientation: 'portrait',
    icons: [
      { src: '/driver-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
    ],
    shortcuts: [
      { name: 'View Orders', url: '/driver', icons: [{ src: '/driver-icon.svg', sizes: 'any' }] }
    ]
  });
});

// Driver PWA — full page
app.get('/driver', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'driver.html'));
});



// Service worker — network-first, fallback to cache
app.get('/driver-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`
const CACHE = 'driver-v3';
const SHELL = ['/driver', '/driver-manifest.json', '/driver-icon.svg', 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache API calls — always go to network
  if (e.request.url.includes('/api/')) return;
  // Network-first for everything else, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request))
  );
});
`);
});

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
        c.name as category, 
        p.price::float as unit_price_usd, 
        p.image_url, 
        p.sort_order, 
        p.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', pc.id,
            'name', pc.ingredient,
            'customization_type', pc.customization_type,
            'price', pc.price::float,
            'option_group_name', ci.option_group_name,
            'is_required', ci.is_required,
            'is_multi_select', ci.is_multi_select
          ))
           FROM product_customizations pc
           LEFT JOIN customization_items ci ON pc.customization_item_id = ci.id
           WHERE pc.product_id = p.id AND pc.is_active = true
          ), '[]'::json
        ) as customizations
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.status = 'Available'
       ORDER BY COALESCE(c.display_order, 9999) ASC, c.name ASC, p.sort_order ASC, p.name ASC`
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

// GET /api/reports/category-summary — Category totals (items & amount per category)
app.get('/api/reports/category-summary', async (req, res) => {
  try {
    const invRes = await pool.query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category, 
        COUNT(p.id)::int as total_products, 
        COALESCE(SUM(p.price::numeric), 0)::float as total_inventory_amount
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'Available'
      GROUP BY COALESCE(c.name, 'Uncategorized')
    `);

    const salesRes = await pool.query(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category, 
        COALESCE(SUM(oi.quantity), 0)::int as total_items_sold, 
        COALESCE(SUM(oi.total_price::numeric), 0)::float as total_sales_amount
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      GROUP BY COALESCE(c.name, 'Uncategorized')
    `);

    const categoryMap = {};

    invRes.rows.forEach(r => {
      categoryMap[r.category] = {
        category: r.category,
        total_products: parseInt(r.total_products, 10) || 0,
        total_inventory_amount: parseFloat(r.total_inventory_amount) || 0,
        total_items_sold: 0,
        total_sales_amount: 0
      };
    });

    salesRes.rows.forEach(r => {
      if (!categoryMap[r.category]) {
        categoryMap[r.category] = {
          category: r.category,
          total_products: 0,
          total_inventory_amount: 0,
          total_items_sold: 0,
          total_sales_amount: 0
        };
      }
      categoryMap[r.category].total_items_sold = parseInt(r.total_items_sold, 10) || 0;
      categoryMap[r.category].total_sales_amount = parseFloat(r.total_sales_amount) || 0;
    });

    const categories = Object.values(categoryMap).sort((a, b) => a.category.localeCompare(b.category));

    const totals = categories.reduce((acc, cat) => {
      acc.total_products += cat.total_products;
      acc.total_inventory_amount += cat.total_inventory_amount;
      acc.total_items_sold += cat.total_items_sold;
      acc.total_sales_amount += cat.total_sales_amount;
      return acc;
    }, { total_products: 0, total_inventory_amount: 0, total_items_sold: 0, total_sales_amount: 0 });

    res.json({ categories, totals });
  } catch (error) {
    console.error('Error generating category report:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, display_order as sort_order FROM categories WHERE is_active = true ORDER BY display_order ASC, name ASC'
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

// GET /api/branches
app.get('/api/branches', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, phone, location, delivery_start_time, delivery_end_time FROM branches WHERE is_active = true ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/order-settings
app.get('/api/order-settings', async (req, res) => {
  try {
    const deliveryResult = await pool.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'delivery_cost' LIMIT 1"
    );
    const discountResult = await pool.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_discount_percentage' LIMIT 1"
    );

    const deliveryCost = deliveryResult.rows.length > 0 ? parseFloat(deliveryResult.rows[0].setting_value) : 3.0;
    const discountPercent = discountResult.rows.length > 0 ? parseFloat(discountResult.rows[0].setting_value) : 15.0;

    res.json({
      deliveryCost,
      discountPercent
    });
  } catch (error) {
    console.error('Error fetching order settings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Helper to calculate Haversine distance in km
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: get real road distance via OSRM (falls back to Haversine)
async function getRoadDistanceKm(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000; // metres → km
    }
  } catch (e) {
    console.warn('OSRM unavailable, falling back to Haversine:', e.message);
  }
  return haversineDistanceKm(lat1, lon1, lat2, lon2);
}

// POST /api/calculate-delivery
app.post('/api/calculate-delivery', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Get branch 1 location
    const branchRes = await pool.query(
      'SELECT location FROM branches WHERE id = 1 LIMIT 1'
    );

    let branchLat = 33.876514; // Default Badaro coordinates (OVR LOAD Cloud Kitchen)
    let branchLng = 35.517225;

    if (branchRes.rows.length > 0 && branchRes.rows[0].location) {
      const coords = branchRes.rows[0].location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coords) {
        branchLat = parseFloat(coords[1]);
        branchLng = parseFloat(coords[2]);
      }
    }

    // Calculate real road distance (OSRM) — falls back to Haversine
    const distanceKm = await getRoadDistanceKm(lat, lng, branchLat, branchLng);

    // Find active pricing rule — most specific match (highest min wins)
    const ruleRes = await pool.query(
      `SELECT id, delivery_cost, min_distance_km, max_distance_km 
       FROM delivery_pricing_rules 
       WHERE is_active = true 
         AND (branch_id = 1 OR branch_id IS NULL)
         AND min_distance_km::float <= $1 
         AND max_distance_km::float > $1
       ORDER BY min_distance_km::float DESC
       LIMIT 1`,
      [distanceKm]
    );

    if (ruleRes.rows.length > 0) {
      const rule = ruleRes.rows[0];
      return res.json({
        fee: parseFloat(rule.delivery_cost),
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        inDeliveryZone: true
      });
    }

    // Check if out of delivery zone (distance is greater than max active rule distance)
    const maxRes = await pool.query(
      `SELECT MAX(max_distance_km) as max_distance 
       FROM delivery_pricing_rules 
       WHERE is_active = true 
         AND (branch_id = 1 OR branch_id IS NULL)`
    );

    const maxDistance = maxRes.rows[0].max_distance ? parseFloat(maxRes.rows[0].max_distance) : 0;

    if (maxDistance > 0 && distanceKm > maxDistance) {
      return res.json({
        fee: 0,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        inDeliveryZone: false,
        error: `Address is outside our delivery zone (maximum distance is ${maxDistance} km)`
      });
    }

    // Default fallback fee on no matched rule
    return res.json({
      fee: 5.0,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      inDeliveryZone: true
    });

  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/orders/pending-delivery — delivery orders not yet picked up (for Driver Dispatch tab)
// No auth required — driver app runs on Android with no admin session
app.get('/api/orders/pending-delivery', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        o.id, o.status, o.order_type, o.delivery_address, o.total_amount,
        o.created_at, o.customer_name, o.customer_phone,
        o.order_source, o.payment_method,
        json_agg(json_build_object(
          'quantity', oi.quantity,
          'product_name', p.name,
          'total_price', oi.total_price
        ) ORDER BY oi.id) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p    ON p.id = oi.product_id
      WHERE (o.order_type ILIKE 'delivery' OR (o.delivery_address IS NOT NULL AND o.delivery_address != ''))
        AND o.status NOT IN ('cancelled', 'delivered')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending delivery orders:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// GET /api/orders/:id — single order detail (used by QR modal)
app.get('/api/orders/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM orders WHERE id = $1 LIMIT 1`,
      [Number(req.params.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// PATCH /api/orders/:id/status — update order status (e.g. mark as delivered)
// No auth required — driver marks orders as picked up from Android
app.patch('/api/orders/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'ready', 'delivered', 'cancelled'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, Number(req.params.id)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});


// Helper function to send automated WhatsApp notifications via Infobip API (Hybrid Text + Template)
async function sendInfobipOrderNotifications({
  orderId,
  customerName,
  customerPhone,
  deliveryAddress,
  deliveryTime,
  items,
  subtotal,
  deliveryFee,
  total,
  lat,
  lng,
  orderType
}) {
  console.log(`[infobip_dispatch] START for Order #${orderId}`);
  const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
  const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
  const sender = (process.env.INFOBIP_WHATSAPP_SENDER || "15558376100").replace("+", "").trim();

  // Multi-line items list
  const multiLineItems = (items || [])
    .map((i) => `• ${i.qty || 1}x *${i.name || i.product_name || "Item"}* ($${Number((i.unit_price_usd || 0) * (i.qty || 1)).toFixed(2)})`)
    .join("\r\n");

  // Single-line items list for template fallback
  const singleLineItems = (items || [])
    .map((i) => `• ${i.qty || 1}x ${i.name || i.product_name || "Item"}`)
    .join("  ");

  const cleanAddr = String(deliveryAddress || "Pickup / Not specified").replace(/\[Maps Pin:.*?\]/gi, "").replace(/[\r\n]+/g, " ").trim();
  const gpsLink = (lat && lng) ? `https://maps.google.com/?q=${lat},${lng}` : null;

  // Helper for sending a message via Text API with Template Fallback
  async function sendMessageSmart(toPhone, multiLineText, templatePlaceholderText) {
    let target = String(toPhone).replace(/\D/g, "");
    if (target.startsWith("00")) target = target.slice(2);
    if (target.startsWith("0") && target.length === 8) target = `961${target.slice(1)}`;
    if (!target.startsWith("961") && target.length >= 7 && target.length <= 8) target = `961${target}`;

    // 1. Try Free-Form Text API (Multi-Line formatted)
    try {
      const textRes = await fetch(`${baseUrl}/whatsapp/1/message/text`, {
        method: "POST",
        headers: {
          "Authorization": `App ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          from: sender,
          to: target,
          content: { text: multiLineText }
        })
      });
      const textData = await textRes.json().catch(() => ({}));
      const msgStatus = textData?.messages?.[0]?.status;

      if (textRes.ok && msgStatus && msgStatus.name !== "REJECTED_NO_SESSION" && msgStatus.id !== 7010) {
        console.log(`[infobip_dispatch] Multi-line text sent successfully to ${target}: status=${textRes.status}`, JSON.stringify(textData));
        return;
      }
      console.warn(`[infobip_dispatch] Text API skipped/rejected for ${target} (${msgStatus?.name || "No session"}), falling back to template...`);
    } catch (e) {
      console.warn(`[infobip_dispatch] Text API error for ${target}, falling back to template:`, e.message);
    }

    // 2. Fallback to Approved Template API
    try {
      const tplRes = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
        method: "POST",
        headers: {
          "Authorization": `App ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          messages: [
            {
              from: sender,
              to: target,
              content: {
                templateName: "order_confirmation",
                templateData: {
                  body: {
                    placeholders: [
                      String(orderId),
                      templatePlaceholderText
                    ]
                  }
                },
                language: "en"
              }
            }
          ]
        })
      });
      const tplData = await tplRes.json().catch(() => ({}));
      console.log(`[infobip_dispatch] Template sent to ${target}: status=${tplRes.status}`, JSON.stringify(tplData));
    } catch (err) {
      console.error(`[infobip_dispatch] Template API error for ${target}:`, err);
    }
  }

  // 1. OVR LOAD MERCHANT NOTIFICATION (96181202607)
  let merchantText = `*NEW ORDER #${orderId} - OVR LOAD*\r\n`;
  merchantText += `================================\r\n\r\n`;
  merchantText += `*Customer Details:*\r\n`;
  merchantText += `• *Order #:* ${orderId}\r\n`;
  merchantText += `• *Name:* ${customerName || "Customer"}\r\n`;
  merchantText += `• *Phone:* ${customerPhone || "N/A"}\r\n`;
  merchantText += `• *Order Type:* ${String(orderType || "delivery").toUpperCase()}\r\n`;
  merchantText += `• *Delivery Address:* ${cleanAddr}\r\n`;
  if (gpsLink) merchantText += `📍 *GPS Location:* ${gpsLink}\r\n`;
  merchantText += `\r\n*Items Ordered:*\r\n${multiLineItems}\r\n\r\n`;
  merchantText += `*Payment Summary:*\r\n`;
  merchantText += `• *Subtotal:* $${Number(subtotal || 0).toFixed(2)}\r\n`;
  if (deliveryFee) merchantText += `• *Delivery Fee:* $${Number(deliveryFee || 0).toFixed(2)}\r\n`;
  merchantText += `• *Total Amount:* $${Number(total || 0).toFixed(2)}`;

  // Send merchant notification (single clean message)
  await sendMessageSmart("96181202607", merchantText, null);

  // 2. CLIENT ORDER CONFIRMATION (Sent only if customer phone is different from merchant phone)
  let clientTarget = String(customerPhone || "").replace(/\D/g, "");
  if (clientTarget.startsWith("00")) clientTarget = clientTarget.slice(2);
  if (clientTarget.startsWith("0") && clientTarget.length === 8) clientTarget = `961${clientTarget.slice(1)}`;
  if (!clientTarget.startsWith("961") && clientTarget.length >= 7 && clientTarget.length <= 8) clientTarget = `961${clientTarget}`;

  if (clientTarget && clientTarget !== "96181202607") {
    let clientText = `✅ *ORDER CONFIRMED - OVR LOAD*\r\n`;
    clientText += `================================\r\n`;
    clientText += `Order #${orderId} has been received!\r\n\r\n`;
    clientText += `*Items Ordered:*\r\n${multiLineItems}\r\n\r\n`;
    clientText += `*Payment Summary:*\r\n`;
    clientText += `• *Total Amount:* $${Number(total || 0).toFixed(2)}\r\n\r\n`;
    clientText += `We are preparing your items now! Thank you for ordering from OVR LOAD.`;

    const clientTemplatePlaceholder = `OVR LOAD  🔹  🛒 ${singleLineItems}  🔹  💵 Total: $${Number(total || 0).toFixed(2)}`;

    await sendMessageSmart(customerPhone, clientText, clientTemplatePlaceholder);
  }
}

// POST /api/orders/save — Save a WhatsApp order to the database
app.post('/api/orders/save', async (req, res) => {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryTime,
    items,          // Array of { id, name, qty, unit_price_usd, customizations }
    subtotal,
    discountAmount,
    deliveryFee,
    total,
    lat,
    lng,
    orderType
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items in order.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Compose special_instructions with delivery time info
    const specialInstructions = `Delivery Time: ${deliveryTime || 'ASAP'}`;

    // Insert order with dedicated customer name & phone columns
    const orderResult = await client.query(
      `INSERT INTO orders
        (branch_id, order_type, order_source, delivery_address, subtotal_amount, delivery_fee, discount_amount,
         total_amount, status, special_instructions, delivery_distance_km, delivery_cost_at_order,
         customer_name, customer_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       RETURNING id`,
      [
        1,                           // branch_id (Ovrload single branch)
        orderType || 'delivery',     // order_type
        'WhatsApp',                  // order_source
        deliveryAddress || '',       // delivery_address
        subtotal || 0,               // subtotal_amount
        deliveryFee || 0,            // delivery_fee
        discountAmount || 0,         // discount_amount
        total || 0,                  // total_amount
        'pending',                   // status
        specialInstructions,         // special_instructions
        lat && lng ? String((await getRoadDistanceKm(33.876514, 35.517225, lat, lng)).toFixed(2)) : null,
        deliveryFee || 0,            // delivery_cost_at_order
        customerName || null,        // customer_name
        customerPhone || null        // customer_phone
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of items) {
      const itemTotal = (item.unit_price_usd || 0) * (item.qty || 1);
      const customizationsText = item.customizations && item.customizations.length > 0
        ? item.customizations.map(c => c.type === 'remove' ? `No ${c.name}` : c.name).join(', ')
        : null;

      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, customizations)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          item.id,
          item.qty || 1,
          item.unit_price_usd || 0,
          itemTotal,
          customizationsText
        ]
      );
    }

    await client.query('COMMIT');

    res.json({ success: true, orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order.' });
  } finally {
    client.release();
  }
});

// GET /driver/scan - Driver Scan Landing Page
app.get('/driver/scan', (req, res) => {
  const lines = [
    '<!DOCTYPE html><html lang="en"><head>',
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">',
    '<title>OVR LOAD - Driver Dispatch</title>',
    '<style>',
    '* { box-sizing:border-box; margin:0; padding:0; }',
    'body { font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#0a0a0a; color:#fff; display:flex; justify-content:center; align-items:center; min-height:100vh; padding:20px; }',
    '.card { background:#161616; border:1px solid #2a2a2a; border-radius:20px; padding:28px 24px; max-width:380px; width:100%; text-align:center; }',
    '.logo { font-size:1rem; font-weight:800; margin-bottom:20px; } .logo span { color:#e66e19; }',
    'h2 { color:#fff; font-size:1.2rem; margin-bottom:8px; }',
    '.oid { color:#e66e19; font-size:1.6rem; font-weight:800; margin-bottom:16px; }',
    'p { color:#8e8e93; font-size:0.88rem; line-height:1.6; margin-bottom:20px; }',
    'input { width:100%; padding:14px; border-radius:12px; border:1px solid #333; background:#1e1e1e; color:#fff; font-size:1.1rem; text-align:center; outline:none; }',
    'input:focus { border-color:#e66e19; }',
    '.btn { width:100%; padding:15px; background:#25d366; color:#fff; font-weight:700; font-size:1rem; border:none; border-radius:12px; cursor:pointer; margin-top:12px; }',
    '.btn:disabled { opacity:0.6; }',
    '.err { color:#ff4a4a; font-size:0.82rem; margin-top:8px; display:none; }',
    '.spinner { width:44px; height:44px; border:3px solid #333; border-top-color:#25d366; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 16px; }',
    '@keyframes spin { to { transform:rotate(360deg); } }',
    '.sub { color:#5e5e62; font-size:0.82rem; margin-bottom:20px; }',
    '.chg { color:#e66e19; font-size:0.82rem; cursor:pointer; background:none; border:none; text-decoration:underline; font-family:inherit; }',
    '.ok-icon { font-size:3rem; margin-bottom:12px; }',
    '.ok-title { font-size:1.2rem; font-weight:700; color:#25d366; margin-bottom:8px; }',
    '[data-s] { display:none; } [data-s].on { display:block; }',
    '</style></head><body>',
    '<div class="card">',
    '<div class="logo"><span>OVR</span>LOAD</div>',
    '<div data-s="form" class="on">',
    '<h2>&#x1F6F5; Delivery Order</h2>',
    '<div class="oid">#<span id="o1"></span></div>',
    '<p>Enter your number once to receive delivery details on WhatsApp automatically every time.</p>',
    '<input type="tel" id="ph" placeholder="e.g. 70 123 456" inputmode="tel" />',
    '<div class="err" id="er">Please enter a valid phone number.</div>',
    '<button class="btn" id="sb" onclick="send()">&#x1F4F2; Send to my WhatsApp</button>',
    '</div>',
    '<div data-s="auto">',
    '<div class="spinner"></div>',
    '<h2>&#x1F6F5; Delivery Order</h2>',
    '<div class="oid">#<span id="o2"></span></div>',
    '<div id="an" style="font-weight:700;margin-bottom:6px;"></div>',
    '<div class="sub">Sending order details to your WhatsApp...</div>',
    '<button class="chg" onclick="chg()">Not you? Change number</button>',
    '</div>',
    '<div data-s="done">',
    '<div class="ok-icon" id="done-icon">&#x2705;</div>',
    '<h2>&#x1F6F5; Delivery Order</h2>',
    '<div class="oid">#<span id="o3"></span></div>',
    '<div class="ok-title" id="done-title">Sent to WhatsApp!</div>',
    '<p id="done-msg">Check WhatsApp for address and delivery details.</p>',
    '<div id="order-details" style="text-align:left;background:#1e1e1e;border-radius:12px;padding:16px;margin-top:12px;font-size:0.88rem;line-height:1.9;display:none;"></div>',
    '</div>',
    '</div>',
    '<script>',
    'var p=new URLSearchParams(location.search),oid=p.get("orderId")||p.get("id")||"?";',
    'document.getElementById("o1").textContent=oid;',
    'document.getElementById("o2").textContent=oid;',
    'document.getElementById("o3").textContent=oid;',
    'function show(n){document.querySelectorAll("[data-s]").forEach(function(e){e.classList.remove("on")});document.querySelector("[data-s="+n+"]").classList.add("on")}',
    'var KEY="ovrload_driver_phone",sv=localStorage.getItem(KEY);',
    'if(sv&&oid!="?"){document.getElementById("an").textContent=sv;show("auto");go(sv);}',
    'function chg(){localStorage.removeItem(KEY);show("form");}',
    'function send(){var v=document.getElementById("ph").value.trim();if(!v||v.length<5){document.getElementById("er").style.display="block";return;}document.getElementById("er").style.display="none";document.getElementById("sb").disabled=true;document.getElementById("sb").textContent="Sending...";localStorage.setItem(KEY,v);go(v);}',
    'function go(phone){fetch("/api/driver/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:oid,driverPhone:phone})}).then(function(r){return r.json();}).then(function(d){show("done");if(d.sentVia){document.getElementById("done-icon").textContent="\u2705";document.getElementById("done-title").textContent="Sent to WhatsApp!";document.getElementById("done-msg").textContent="Check WhatsApp for your delivery details."}else{document.getElementById("done-icon").textContent="\uD83D\uDCCB";document.getElementById("done-title").textContent="Delivery Details";document.getElementById("done-msg").textContent="";if(d.orderDetails){var od=d.orderDetails;var el=document.getElementById("order-details");el.style.display="block";el.innerHTML="<b>Order #"+od.id+"</b><br>Customer: "+od.customerName+"<br>Phone: "+od.customerPhone+"<br>Address: "+od.address+"<br><br><b>Items:</b><br>"+od.items+"<br><br><b>Collect: $"+od.total+"</b>"}}}).catch(function(){show("done");});}',
    '</script></body></html>'
  ];
  res.send(lines.join('\n'));
});

// POST /api/driver/scan — Send delivery details to driver via Infobip WhatsApp template
app.post('/api/driver/scan', async (req, res) => {
  const { orderId, driverPhone, phone } = req.body;
  const phoneNum = driverPhone || phone;
  if (!orderId || !phoneNum) {
    return res.status(400).json({ error: 'Order ID and phone are required.' });
  }

  const client = await pool.connect();
  try {
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 LIMIT 1', [Number(orderId)]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderRes.rows[0];

    const itemsRes = await client.query(
      'SELECT i.*, p.name as product_name FROM order_items i LEFT JOIN products p ON i.product_id = p.id WHERE i.order_id = $1',
      [Number(orderId)]
    );
    const items = itemsRes.rows;

    const multiLineItems = items
      .map(i => '• ' + i.quantity + 'x *' + (i.product_name || 'Item') + '* ($' + Number(i.total_price || 0).toFixed(2) + ')')
      .join('\n');

    const cleanAddr = String(order.delivery_address || 'Pickup')
      .replace(/\[Maps Pin:[^\]]*\]/gi, '').replace(/[\r\n]+/g, ' ').trim() || 'Pickup';

    // Extract Maps Pin URL if present
    const mapsMatch = String(order.delivery_address || '').match(/\[Maps Pin:\s*(https?:\/\/[^\]]+)\]/i);
    const mapsUrl = mapsMatch ? mapsMatch[1].trim() : null;

    // Infobip placeholders cannot contain newlines — use single-line compact format
    const itemsSingle = items
      .map(i => i.quantity + 'x ' + (i.product_name || 'Item'))
      .join(', ');

    const deliveryFee = Number(order.delivery_fee || order.delivery_cost_at_order || 0);

    const driverText = '🛵 OVR LOAD DELIVERY'
      + ' | Order #' + order.id
      + ' | ' + (order.customer_name || '-')
      + ' | ' + (order.customer_phone || 'N/A')
      + ' | ' + cleanAddr
      + (mapsUrl ? ' | 📍 ' + mapsUrl : '')
      + ' | ' + itemsSingle
      + (deliveryFee > 0 ? ' | Delivery: $' + deliveryFee.toFixed(2) : '')
      + ' | Collect: $' + Number(order.total_amount || 0).toFixed(2);


    // Normalize phone
    let target = String(phoneNum).replace(/\D/g, '');
    if (target.startsWith('00')) target = target.slice(2);
    if (target.startsWith('0') && target.length === 8) target = '961' + target.slice(1);
    if (!target.startsWith('961') && target.length >= 7 && target.length <= 8) target = '961' + target;

    const apiKey = process.env.INFOBIP_API_KEY || 'd42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e';
    const baseUrl = (process.env.INFOBIP_BASE_URL || 'https://y4r1q1.api.infobip.com').replace(/\/$/, '');
    const sender = (process.env.INFOBIP_WHATSAPP_SENDER || '15558376100').replace('+', '').trim();

    // wa.me fallback keeps full multiline format
    const waUrl = 'https://wa.me/' + target + '?text=' + encodeURIComponent(driverText);


    let sentVia = null;
    try {
      // Template message — works without an active session
      const tplRes = await fetch(baseUrl + '/whatsapp/1/message/template', {
        method: 'POST',
        headers: { 'Authorization': 'App ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          messages: [{
            from: sender,
            to: target,
            content: {
              templateName: 'order_to_driver',
              templateData: { body: { placeholders: [driverText] } },
              language: 'en'
            }
          }]
        })
      });
      const tplData = await tplRes.json().catch(() => ({}));
      const tplStatus = tplData && tplData.messages && tplData.messages[0] ? tplData.messages[0].status : null;
      console.log('[driver_scan] Template result:', tplRes.status, JSON.stringify(tplStatus));
      if (tplRes.ok && tplStatus && tplStatus.groupId !== 2) {
        sentVia = 'template';
      } else {
        console.log('[driver_scan] Template failed, no text fallback. groupId:', tplStatus && tplStatus.groupId, 'name:', tplStatus && tplStatus.name);
      }
    } catch (e) {
      console.error('[driver_scan] Infobip error:', e.message);
    }

    // Return order details so scan page can display them if WhatsApp wasn't sent
    res.json({
      success: true,
      orderId: order.id,
      sentVia,
      waUrl,
      orderDetails: {
        id: order.id,
        customerName: order.customer_name || '-',
        customerPhone: order.customer_phone || 'N/A',
        address: cleanAddr,
        items: items.map(i => i.quantity + 'x ' + (i.product_name || 'Item')).join(', '),
        total: Number(order.total_amount || 0).toFixed(2)
      }
    });
  } catch (err) {
    console.error('Error dispatching to driver:', err);
    res.status(500).json({ error: 'Failed to dispatch.' });
  } finally {
    client.release();
  }
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
