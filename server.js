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

    let branchLat = 33.876503; // Default Badaro coordinates
    let branchLng = 35.517279;

    if (branchRes.rows.length > 0 && branchRes.rows[0].location) {
      const coords = branchRes.rows[0].location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coords) {
        branchLat = parseFloat(coords[1]);
        branchLng = parseFloat(coords[2]);
      }
    }

    // Calculate distance
    const distanceKm = haversineDistanceKm(lat, lng, branchLat, branchLng);

    // Find active pricing rule
    const ruleRes = await pool.query(
      `SELECT id, delivery_cost, min_distance_km, max_distance_km 
       FROM delivery_pricing_rules 
       WHERE is_active = true 
         AND (branch_id = 1 OR branch_id IS NULL)
         AND min_distance_km <= $1 
         AND max_distance_km >= $1
       ORDER BY branch_id NULLS LAST, display_order ASC, id ASC
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

// Helper function to send automated WhatsApp notifications via Infobip Template API
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
  console.log(`[infobip_template_dispatch] START for Order #${orderId}`);
  const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
  const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
  const sender = (process.env.INFOBIP_WHATSAPP_SENDER || "15558376100").replace("+", "").trim();

  const itemsText = (items || [])
    .map((i) => `• ${i.qty || 1}x ${i.name} ($${Number((i.unit_price_usd || 0) * (i.qty || 1)).toFixed(2)})`)
    .join("\n");

  const locLink = (lat && lng) ? `\n📍 GPS Location: https://maps.google.com/?q=${lat},${lng}` : "";

  // 1. TEMPLATE NOTIFICATION FOR OVR LOAD (new_order_to_branch)
  const ovrloadPayload = {
    messages: [
      {
        from: sender,
        to: "96181202607",
        content: {
          templateName: "new_order_to_branch",
          templateData: {
            body: {
              placeholders: [
                String(orderId),
                "OVR LOAD",
                itemsText || "No items listed",
                `$${Number(total || 0).toFixed(2)}`,
                `${customerName || "N/A"} (${customerPhone || "N/A"})`,
                deliveryAddress || "Pickup / Not specified"
              ]
            }
          },
          language: "en"
        }
      }
    ]
  };

  try {
    const resOvr = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
      method: "POST",
      headers: {
        "Authorization": `App ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(ovrloadPayload)
    });
    const ovrData = await resOvr.json().catch(() => ({}));
    console.log(`[infobip_template_dispatch] Sent template "new_order_to_branch" to OVR LOAD (96181202607): status=${resOvr.status}`, JSON.stringify(ovrData));
  } catch (err) {
    console.error("[infobip_template_dispatch] Error sending template to OVR LOAD:", err);
  }

  // 2. CLIENT ORDER CONFIRMATION TEMPLATE (order_confirmation - MEDIA TEMPLATE)
  if (customerPhone) {
    let clientTo = String(customerPhone).replace(/\D/g, "");
    if (clientTo.startsWith("00")) clientTo = clientTo.slice(2);
    if (clientTo.startsWith("0") && clientTo.length === 8) clientTo = `961${clientTo.slice(1)}`;
    if (!clientTo.startsWith("961") && clientTo.length >= 7 && clientTo.length <= 8) clientTo = `961${clientTo}`;

    const clientPayload = {
      messages: [
        {
          from: sender,
          to: clientTo,
          content: {
            templateName: "order_confirmation",
            templateData: {
              header: {
                type: "IMAGE",
                mediaUrl: "https://ovrload-nine.vercel.app/images/logo.png"
              },
              body: {
                placeholders: [
                  String(orderId),
                  "OVR LOAD",
                  itemsText || "No items listed",
                  `$${Number(total || 0).toFixed(2)}`
                ]
              }
            },
            language: "en"
          }
        }
      ]
    };

    try {
      const resCli = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
        method: "POST",
        headers: {
          "Authorization": `App ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(clientPayload)
      });
      const cliData = await resCli.json().catch(() => ({}));
      console.log(`[infobip_template_dispatch] Sent template "order_confirmation" to Client (${clientTo}): status=${resCli.status}`, JSON.stringify(cliData));
    } catch (err) {
      console.error("[infobip_template_dispatch] Error sending template to Client:", err);
    }
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
        (branch_id, order_type, delivery_address, subtotal_amount, delivery_fee, discount_amount,
         total_amount, status, special_instructions, delivery_distance_km, delivery_cost_at_order,
         customer_name, customer_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING id`,
      [
        1,                           // branch_id (Ovrload single branch)
        orderType || 'delivery',     // order_type
        deliveryAddress || '',       // delivery_address
        subtotal || 0,               // subtotal_amount
        deliveryFee || 0,            // delivery_fee
        discountAmount || 0,         // discount_amount
        total || 0,                  // total_amount
        'pending',                   // status
        specialInstructions,         // special_instructions
        lat && lng ? String(haversineDistanceKm(33.876503, 35.517279, lat, lng).toFixed(2)) : null,
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

    // Trigger WhatsApp dispatch via Infobip
    sendInfobipOrderNotifications({
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
    }).catch(err => console.error("[infobip_dispatch] Async error:", err));

    res.json({ success: true, orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order.' });
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
