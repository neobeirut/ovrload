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

// GET /api/orders/pending-delivery — delivery orders not yet picked up (for Driver Dispatch tab)
app.get('/api/orders/pending-delivery', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        o.id, o.status, o.order_type, o.delivery_address, o.total_amount,
        o.created_at, o.latitude, o.longitude,
        u.name AS customer_name, u.phone AS customer_phone,
        json_agg(json_build_object(
          'quantity', oi.quantity,
          'product_name', p.name,
          'total_price', oi.total_price
        ) ORDER BY oi.id) AS items
      FROM orders o
      LEFT JOIN auth_users u  ON o.user_id = u.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p    ON p.id = oi.product_id
      WHERE o.order_type ILIKE 'delivery'
        AND o.status IN ('pending', 'confirmed', 'ready')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY o.id, u.name, u.phone
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
    const result = await client.query(`
      SELECT o.*, u.name AS customer_name, u.phone AS customer_phone
      FROM orders o
      LEFT JOIN auth_users u ON o.user_id = u.id
      WHERE o.id = $1 LIMIT 1
    `, [Number(req.params.id)]);
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
app.patch('/api/orders/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'ready', 'delivered', 'cancelled'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
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

    // Await WhatsApp dispatch via Infobip so Vercel serverless process doesn't terminate early
    try {
      await sendInfobipOrderNotifications({
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
      });
    } catch (err) {
      console.error("[infobip_dispatch] Error:", err);
    }

    res.json({ success: true, orderId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving order:', error);
    res.status(500).json({ error: 'Failed to save order.' });
  } finally {
    client.release();
  }
});

// GET /driver/scan — Driver Scan Landing Page
app.get('/driver/scan', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OVR LOAD — Driver Order Dispatch</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #121212; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 16px; padding: 24px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #ff5722; font-size: 1.5rem; }
    p { color: #bbb; font-size: 0.95rem; line-height: 1.5; }
    input { width: 100%; padding: 14px; margin: 16px 0; border-radius: 10px; border: 1px solid #444; background: #2a2a2a; color: #fff; font-size: 1rem; box-sizing: border-box; text-align: center; }
    button { width: 100%; padding: 14px; background: #25d366; color: #fff; font-weight: bold; font-size: 1rem; border: none; border-radius: 10px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #1ebd59; }
    .status { margin-top: 16px; font-weight: bold; color: #4caf50; font-size: 1.1rem; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🛵 Delivery Order #<span id="orderIdText">...</span></h2>
    <p>Scan confirmed! Enter your phone number once to receive complete order details & Google Maps PIN directly on WhatsApp.</p>
    
    <div id="formSection">
      <input type="tel" id="driverPhoneInput" placeholder="Enter your phone number (e.g. 70123456)" />
      <button onclick="dispatchToDriver()">Send to my WhatsApp</button>
    </div>

    <div id="statusSection" class="hidden">
      <p class="status">✅ Order Dispatched to Your WhatsApp!</p>
      <p style="font-size: 0.85rem; color: #888;">Check your WhatsApp inbox for customer phone number, delivery address & map pin.</p>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('orderId') || urlParams.get('id');
    document.getElementById('orderIdText').textContent = orderId || 'N/A';

    const savedPhone = localStorage.getItem('ovrload_driver_phone');
    if (savedPhone) {
      document.getElementById('driverPhoneInput').value = savedPhone;
      if (orderId) {
        dispatchToDriver(savedPhone);
      }
    }

    async function dispatchToDriver(phoneOverride) {
      const phone = phoneOverride || document.getElementById('driverPhoneInput').value.trim();
      if (!phone) {
        alert('Please enter your phone number.');
        return;
      }

      localStorage.setItem('ovrload_driver_phone', phone);
      document.getElementById('formSection').classList.add('hidden');
      document.getElementById('statusSection').classList.remove('hidden');

      try {
        await fetch('/api/driver/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, driverPhone: phone })
        });
      } catch (e) {
        console.error(e);
      }
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// POST /api/driver/scan — Dispatch order details to driver's WhatsApp via Infobip
app.post('/api/driver/scan', async (req, res) => {
  const { orderId, driverPhone } = req.body;
  if (!orderId || !driverPhone) {
    return res.status(400).json({ error: 'Order ID and Driver Phone number are required.' });
  }

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      \`SELECT o.*, u.name as customer_name, u.phone as customer_phone
       FROM orders o
       LEFT JOIN auth_users u ON o.user_id = u.id
       WHERE o.id = $1 LIMIT 1\`,
      [Number(orderId)]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    const itemsRes = await client.query(
      \`SELECT i.*, p.name as product_name
       FROM order_items i
       LEFT JOIN products p ON i.product_id = p.id
       WHERE i.order_id = $1\`,
      [Number(orderId)]
    );
    const items = itemsRes.rows;

    const multiLineItems = items
      .map((i) => \`• \${i.quantity}x *\${i.product_name || 'Item'}* ($\${Number(i.total_price || 0).toFixed(2)})\`)
      .join('\\r\\n');

    const singleLineItems = items
      .map((i) => \`• \${i.quantity}x \${i.product_name || 'Item'}\`)
      .join('  ');

    const cleanAddr = String(order.delivery_address || 'Pickup / Not specified').replace(/\[Maps Pin:.*?\]/gi, '').replace(/[\\r\\n]+/g, ' ').trim();
    const gpsLink = (order.latitude && order.longitude) ? \`https://maps.google.com/?q=\${order.latitude},\${order.longitude}\` : null;

    let driverText = \`🛵 *DELIVERY ORDER ASSIGNMENT - OVR LOAD*\\r\\n\`;
    driverText += \`================================\\r\\n\\r\\n\`;
    driverText += \`*Order Number:* #\${order.id}\\r\\n\\r\\n\`;
    driverText += \`*Customer Info:*\\r\\n\`;
    driverText += \`• *Name:* \${order.customer_name || 'Customer'}\\r\\n\`;
    driverText += \`• *Phone:* \${order.customer_phone || 'N/A'}\\r\\n\`;
    driverText += \`• *Delivery Address:* \${cleanAddr}\\r\\n\`;
    if (gpsLink) driverText += \`📍 *GPS Location:* \${gpsLink}\\r\\n\`;
    driverText += \`\\r\\n*Items to Deliver:*\\r\\n\${multiLineItems}\\r\\n\\r\\n\`;
    driverText += \`*Collect Payment:*\\r\\n\`;
    driverText += \`• *Total Amount:* $\${Number(order.total_amount || 0).toFixed(2)}\`;

    const templatePlaceholder = \`OVR LOAD  🔹  👤 \${order.customer_name || 'Cust'} (\${order.customer_phone || 'N/A'})  🔹  📍 \${cleanAddr}\${gpsLink ? \` (GPS: \${gpsLink})\` : ''}  🔹  🛒 \${singleLineItems}  🔹  💵 Collect Total: $\${Number(order.total_amount || 0).toFixed(2)}\`;

    const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
    const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\\/$/, "");
    const sender = (process.env.INFOBIP_WHATSAPP_SENDER || "15558376100").replace("+", "").trim();

    let target = String(driverPhone).replace(/\\D/g, "");
    if (target.startsWith("00")) target = target.slice(2);
    if (target.startsWith("0") && target.length === 8) target = \`961\${target.slice(1)}\`;
    if (!target.startsWith("961") && target.length >= 7 && target.length <= 8) target = \`961\${target}\`;

    let sentVia = "text";
    try {
      const textRes = await fetch(\`\${baseUrl}/whatsapp/1/message/text\`, {
        method: "POST",
        headers: {
          "Authorization": \`App \${apiKey}\`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ from: sender, to: target, content: { text: driverText } })
      });
      const textData = await textRes.json().catch(() => ({}));
      const msgStatus = textData?.messages?.[0]?.status;

      if (!textRes.ok || (msgStatus && (msgStatus.name === "REJECTED_NO_SESSION" || msgStatus.id === 7010))) {
        sentVia = "template";
        await fetch(\`\${baseUrl}/whatsapp/1/message/template\`, {
          method: "POST",
          headers: {
            "Authorization": \`App \${apiKey}\`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            messages: [{
              from: sender,
              to: target,
              content: {
                templateName: "order_confirmation",
                templateData: { body: { placeholders: [String(order.id), templatePlaceholder] } },
                language: "en"
              }
            }]
          })
        });
      }
    } catch (e) {
      console.error("[driver_scan] Dispatch error:", e);
    }

    res.json({ success: true, orderId: order.id, driverPhone: target, sentVia });
  } catch (err) {
    console.error('Error dispatching to driver:', err);
    res.status(500).json({ error: 'Failed to dispatch order to driver.' });
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
