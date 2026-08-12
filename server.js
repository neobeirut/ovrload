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
// Manifest for PWA installability
app.get('/driver-manifest.json', (req, res) => {
  res.json({
    name: 'OVR LOAD — Driver',
    short_name: 'Driver',
    description: 'OVR LOAD Driver Dispatch App',
    start_url: '/driver',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#e66e19',
    orientation: 'portrait',
    icons: [
      { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  });
});

// Driver PWA — full page
app.get('/driver', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Driver">
  <meta name="theme-color" content="#e66e19">
  <title>OVR LOAD — Driver</title>
  <link rel="manifest" href="/driver-manifest.json">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    :root {
      --bg: #0a0a0a; --surface: #141414; --surface2: #1e1e1e;
      --border: rgba(255,255,255,0.08); --primary: #e66e19;
      --primary-h: #ff802b; --text: #fff; --text2: #8e8e93; --text3: #5e5e62;
      --green: #25d366; --yellow: #ffc107; --blue: #42a5f5;
    }
    html, body { background: var(--bg); color: var(--text); font-family: -apple-system, 'Outfit', BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; height: 100%; overflow: hidden; }
    /* Header */
    .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0.9rem 1.25rem; display: flex; align-items: center; justify-content: space-between; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
    .header-brand { display: flex; align-items: center; gap: 0.5rem; }
    .header-brand .ovr { color: var(--primary); font-weight: 800; font-size: 1.2rem; letter-spacing: -0.5px; }
    .header-brand .sep { color: var(--text3); font-size: 1rem; }
    .header-brand .label { color: var(--text2); font-weight: 600; font-size: 0.85rem; }
    .header-right { display: flex; align-items: center; gap: 0.75rem; }
    .refresh-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text2); padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
    .refresh-btn:active { background: var(--primary); color: #fff; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    /* Order list */
    .list-wrap { position: fixed; top: 57px; bottom: 0; left: 0; right: 0; overflow-y: auto; padding: 1rem; }
    .section-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text3); margin: 0.5rem 0 0.6rem; padding: 0 0.25rem; }
    .order-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1rem 1.1rem; margin-bottom: 0.75rem; cursor: pointer; transition: border-color 0.15s, transform 0.1s; active:transform:scale(0.98); user-select: none; }
    .order-card:active { transform: scale(0.98); border-color: var(--primary); }
    .order-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
    .order-id { font-size: 1rem; font-weight: 700; color: var(--primary); }
    .order-badge { font-size: 0.68rem; font-weight: 700; padding: 3px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.04em; }
    .badge-pending  { background: rgba(255,193,7,0.15);  color: var(--yellow); border: 1px solid rgba(255,193,7,0.25); }
    .badge-confirmed{ background: rgba(66,165,245,0.15); color: var(--blue);   border: 1px solid rgba(66,165,245,0.25); }
    .badge-ready    { background: rgba(37,211,102,0.15); color: var(--green);  border: 1px solid rgba(37,211,102,0.25); }
    .badge-completed{ background: rgba(255,255,255,0.06); color: var(--text3); border: 1px solid var(--border); }
    .order-name { font-size: 0.92rem; color: var(--text2); margin-bottom: 2px; }
    .order-addr { font-size: 0.78rem; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .order-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 0.55rem; }
    .order-items-preview { font-size: 0.75rem; color: var(--text3); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 0.75rem; }
    .order-total { font-size: 0.95rem; font-weight: 700; color: var(--text); white-space: nowrap; }
    .order-time { font-size: 0.7rem; color: var(--text3); margin-left: 0.5rem; }
    /* Empty state */
    .empty { text-align: center; padding: 5rem 2rem; }
    .empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .empty-title { color: var(--text2); font-size: 1rem; margin-bottom: 0.4rem; }
    .empty-sub { color: var(--text3); font-size: 0.82rem; }
    /* QR Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 999; align-items: center; justify-content: center; padding: 1.5rem; }
    .modal-overlay.open { display: flex; }
    .modal-box { background: #161616; border: 1px solid #2a2a2a; border-radius: 24px; padding: 1.75rem 1.5rem 1.5rem; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.8); }
    .modal-order-id { font-size: 1.3rem; font-weight: 800; color: var(--primary); margin-bottom: 0.2rem; }
    .modal-customer { font-size: 0.88rem; color: var(--text2); margin-bottom: 0.2rem; }
    .modal-address { font-size: 0.78rem; color: var(--text3); margin-bottom: 1.25rem; }
    .qr-wrap { display: flex; justify-content: center; align-items: center; background: #fff; border-radius: 16px; padding: 1rem; margin-bottom: 0.75rem; }
    .qr-hint { font-size: 0.78rem; color: var(--text3); margin-bottom: 1.25rem; line-height: 1.5; }
    .modal-actions { display: flex; gap: 0.65rem; }
    .btn-pickup { flex: 1; padding: 0.85rem; background: var(--green); color: #fff; font-weight: 700; font-size: 0.9rem; border: none; border-radius: 12px; cursor: pointer; transition: opacity 0.15s; }
    .btn-pickup:active { opacity: 0.8; }
    .btn-close  { padding: 0.85rem 1rem; background: var(--surface2); color: var(--text2); font-size: 0.9rem; border: 1px solid var(--border); border-radius: 12px; cursor: pointer; }
    /* Install banner */
    .install-banner { display: none; position: fixed; bottom: 1rem; left: 1rem; right: 1rem; background: var(--primary); color: #fff; border-radius: 14px; padding: 0.85rem 1rem; font-size: 0.85rem; font-weight: 600; align-items: center; justify-content: space-between; z-index: 200; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
    .install-banner.show { display: flex; }
    .install-banner button { background: rgba(255,255,255,0.2); border: none; color: #fff; padding: 0.4rem 0.85rem; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.82rem; }
    .toast { position: fixed; bottom: 5rem; left: 50%; transform: translateX(-50%); background: #1e1e1e; color: var(--text); border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: 10px; font-size: 0.82rem; z-index: 500; opacity: 0; transition: opacity 0.3s; pointer-events: none; white-space: nowrap; }
    .toast.show { opacity: 1; }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="header-brand">
      <span class="ovr">OVR</span><span class="sep">/</span>
      <span class="label">Driver Dispatch</span>
    </div>
    <div class="header-right">
      <div class="status-dot" id="status-dot" title="Live"></div>
      <button class="refresh-btn" id="refresh-btn">↻ Refresh</button>
    </div>
  </header>

  <!-- Order List -->
  <div class="list-wrap" id="list-wrap">
    <div class="empty">
      <div class="empty-icon">🛵</div>
      <div class="empty-title">Loading orders...</div>
    </div>
  </div>

  <!-- QR Modal -->
  <div class="modal-overlay" id="qr-modal">
    <div class="modal-box">
      <div class="modal-order-id" id="m-order-id">Order #—</div>
      <div class="modal-customer" id="m-customer"></div>
      <div class="modal-address" id="m-address"></div>
      <div class="qr-wrap"><div id="qr-canvas"></div></div>
      <div class="qr-hint">Driver: scan with your phone camera to receive full delivery details on WhatsApp</div>
      <div class="modal-actions">
        <button class="btn-pickup" id="btn-pickup">✅ Mark as Picked Up</button>
        <button class="btn-close"  id="btn-close">✕</button>
      </div>
    </div>
  </div>

  <!-- Install banner -->
  <div class="install-banner" id="install-banner">
    <span>📲 Install Driver App for quick access</span>
    <button id="install-btn">Install</button>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    // ── State ──────────────────────────────────────────────────
    let orders = [];
    let activeOrderId = null;
    let deferredInstallPrompt = null;
    let qrInstance = null;

    // ── PWA Install ────────────────────────────────────────────
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      document.getElementById('install-banner').classList.add('show');
    });
    document.getElementById('install-btn').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') document.getElementById('install-banner').classList.remove('show');
    });

    // ── Toast ──────────────────────────────────────────────────
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ── Time ago ──────────────────────────────────────────────
    function timeAgo(iso) {
      const s = Math.floor((Date.now() - new Date(iso)) / 1000);
      if (s < 60)   return s + 's ago';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      return Math.floor(s / 3600) + 'h ago';
    }

    // ── Load Orders ────────────────────────────────────────────
    async function loadOrders() {
      const dot = document.getElementById('status-dot');
      dot.style.background = '#ffc107';
      try {
        const res = await fetch('/api/orders/pending-delivery');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        orders = await res.json();
        renderOrders();
        dot.style.background = 'var(--green)';
      } catch(e) {
        dot.style.background = '#ff4a4a';
        showToast('⚠️ Could not load orders');
      }
    }

    // ── Render ─────────────────────────────────────────────────
    function renderOrders() {
      const wrap = document.getElementById('list-wrap');
      if (!orders.length) {
        wrap.innerHTML = '<div class="empty"><div class="empty-icon">🛵</div><div class="empty-title">No active delivery orders</div><div class="empty-sub">New orders will appear here automatically</div></div>';
        return;
      }

      const active   = orders.filter(o => ['pending','confirmed','ready'].includes(o.status));
      const recent   = orders.filter(o => !['pending','confirmed','ready'].includes(o.status));

      let html = '';
      if (active.length) {
        html += '<div class="section-title">Active — ' + active.length + ' order' + (active.length > 1 ? 's' : '') + '</div>';
        html += active.map(cardHTML).join('');
      }
      if (recent.length) {
        html += '<div class="section-title" style="margin-top:1.25rem">Recently Completed</div>';
        html += recent.map(cardHTML).join('');
      }
      wrap.innerHTML = html;
    }

    function cardHTML(o) {
      const name = (o.customer_name || 'Customer').trim();
      const addr = (o.delivery_address || '').replace(/\\[Maps Pin:.*?\\]/gi,'').replace(/[\\r\\n]+/g,' ').trim();
      const items = (o.items || []).filter(i => i && i.product_name).map(i => i.quantity + 'x ' + i.product_name).join(' • ') || '—';
      const badgeMap = { pending:'badge-pending', confirmed:'badge-confirmed', ready:'badge-ready', completed:'badge-completed' };
      const labelMap = { pending:'⏳ Pending', confirmed:'● Confirmed', ready:'✓ Ready', completed:'Completed' };
      const badge = badgeMap[o.status] || 'badge-completed';
      const label = labelMap[o.status] || o.status;
      return '<div class="order-card" onclick="openQR(' + o.id + ')">' +
        '<div class="order-card-top">' +
          '<span class="order-id">#' + o.id + '</span>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;">' +
            '<span class="order-badge ' + badge + '">' + label + '</span>' +
            '<span class="order-time">' + timeAgo(o.created_at) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="order-name">👤 ' + esc(name) + '</div>' +
        (addr ? '<div class="order-addr">📍 ' + esc(addr) + '</div>' : '') +
        '<div class="order-bottom">' +
          '<span class="order-items-preview">🛒 ' + esc(items) + '</span>' +
          '<span class="order-total">$' + Number(o.total_amount || 0).toFixed(2) + '</span>' +
        '</div>' +
      '</div>';
    }

    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── QR Modal ───────────────────────────────────────────────
    window.openQR = function(orderId) {
      activeOrderId = orderId;
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const name = (order.customer_name || 'Customer').trim();
      const addr = (order.delivery_address || '').replace(/\\[Maps Pin:.*?\\]/gi,'').replace(/[\\r\\n]+/g,' ').trim();

      document.getElementById('m-order-id').textContent = 'Order #' + orderId;
      document.getElementById('m-customer').textContent = '👤 ' + name + (order.customer_phone ? '  ·  ' + order.customer_phone : '');
      document.getElementById('m-address').textContent  = addr ? '📍 ' + addr : '';

      // Generate QR
      const canvas = document.getElementById('qr-canvas');
      canvas.innerHTML = '';
      const url = 'https://ovrload-nine.vercel.app/driver/scan?orderId=' + orderId;
      qrInstance = new QRCode(canvas, { text: url, width: 220, height: 220, colorDark: '#000', colorLight: '#fff', correctLevel: QRCode.CorrectLevel.M });

      document.getElementById('qr-modal').classList.add('open');
    };

    document.getElementById('btn-close').addEventListener('click', closeModal);
    document.getElementById('qr-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    function closeModal() { document.getElementById('qr-modal').classList.remove('open'); activeOrderId = null; }

    // ── Mark as Picked Up ──────────────────────────────────────
    document.getElementById('btn-pickup').addEventListener('click', async () => {
      if (!activeOrderId) return;
      const btn = document.getElementById('btn-pickup');
      btn.textContent = 'Updating...'; btn.disabled = true;
      try {
        const res = await fetch('/api/orders/' + activeOrderId + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivered' })
        });
        if (res.ok) {
          closeModal();
          showToast('✅ Order #' + activeOrderId + ' marked as picked up');
          await loadOrders();
        } else {
          showToast('⚠️ Failed to update order');
        }
      } catch(e) {
        showToast('⚠️ Connection error');
      } finally {
        btn.textContent = '✅ Mark as Picked Up'; btn.disabled = false;
      }
    });

    // ── Auto-refresh ───────────────────────────────────────────
    document.getElementById('refresh-btn').addEventListener('click', () => { loadOrders(); showToast('Refreshed'); });
    setInterval(loadOrders, 30000);

    // ── Boot ───────────────────────────────────────────────────
    loadOrders();

    // Register service worker for PWA offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/driver-sw.js').catch(() => {});
    }
  </script>
</body>
</html>`);
});

// Minimal service worker for PWA caching
app.get('/driver-sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send([
    "const CACHE = 'driver-v1';",
    "const ASSETS = ['/driver'];",
    "self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))));",
    "self.addEventListener('fetch', e => {",
    "  if (e.request.url.includes('/api/')) return;",
    "  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));",
    "});"
  ].join('\n'));
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
// No auth required — driver app runs on Android with no admin session
app.get('/api/orders/pending-delivery', async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        o.id, o.status, o.order_type, o.delivery_address, o.total_amount,
        o.created_at, o.customer_name, o.customer_phone,
        json_agg(json_build_object(
          'quantity', oi.quantity,
          'product_name', p.name,
          'total_price', oi.total_price
        ) ORDER BY oi.id) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p    ON p.id = oi.product_id
      WHERE (o.order_type ILIKE 'delivery' OR (o.delivery_address IS NOT NULL AND o.delivery_address != ''))
        AND o.status NOT IN ('cancelled', 'completed', 'delivered')
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
    '<div class="ok-icon">&#x2705;</div>',
    '<h2>&#x1F6F5; Delivery Order</h2>',
    '<div class="oid">#<span id="o3"></span></div>',
    '<div class="ok-title">Sent to WhatsApp!</div>',
    '<p>Check WhatsApp for address and delivery details.</p>',
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
    'function go(phone){fetch("/api/driver/scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId:oid,driverPhone:phone})}).catch(function(){}).finally(function(){show("done");});}',
    '</script></body></html>'
  ];
  res.send(lines.join('\n'));
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
      'SELECT * FROM orders WHERE id = $1 LIMIT 1',
      [Number(orderId)]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderRes.rows[0];

    const itemsRes = await client.query(
      'SELECT i.*, p.name as product_name FROM order_items i LEFT JOIN products p ON i.product_id = p.id WHERE i.order_id = $1',
      [Number(orderId)]
    );
    const items = itemsRes.rows;

    const multiLineItems = items
      .map((i) => '• ' + i.quantity + 'x *' + (i.product_name || 'Item') + '* ($' + Number(i.total_price || 0).toFixed(2) + ')')
      .join('\r\n');

    const singleLineItems = items
      .map((i) => '• ' + i.quantity + 'x ' + (i.product_name || 'Item'))
      .join('  ');

    const cleanAddr = String(order.delivery_address || 'Pickup / Not specified')
      .replace(/\[Maps Pin:.*?\]/gi, '').replace(/[\r\n]+/g, ' ').trim();

    let driverText = '🛵 *DELIVERY ORDER ASSIGNMENT - OVR LOAD*\r\n';
    driverText += '================================\r\n\r\n';
    driverText += '*Order Number:* #' + order.id + '\r\n\r\n';
    driverText += '*Customer Info:*\r\n';
    driverText += '• *Name:* ' + (order.customer_name || 'Customer') + '\r\n';
    driverText += '• *Phone:* ' + (order.customer_phone || 'N/A') + '\r\n';
    driverText += '• *Delivery Address:* ' + cleanAddr + '\r\n';
    driverText += '\r\n*Items to Deliver:*\r\n' + multiLineItems + '\r\n\r\n';
    driverText += '*Collect Payment:*\r\n';
    driverText += '• *Total Amount:* $' + Number(order.total_amount || 0).toFixed(2);

    const templatePlaceholder = 'OVR LOAD  🔹  👤 ' + (order.customer_name || 'Cust') +
      ' (' + (order.customer_phone || 'N/A') + ')  🔹  📍 ' + cleanAddr +
      '  🔹  🛒 ' + singleLineItems + '  🔹  💵 Collect Total: $' + Number(order.total_amount || 0).toFixed(2);

    const apiKey = process.env.INFOBIP_API_KEY || 'd42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e';
    const baseUrl = (process.env.INFOBIP_BASE_URL || 'https://y4r1q1.api.infobip.com').replace(/\/$/, '');
    const sender = (process.env.INFOBIP_WHATSAPP_SENDER || '15558376100').replace('+', '').trim();

    let target = String(driverPhone).replace(/\D/g, '');
    if (target.startsWith('00')) target = target.slice(2);
    if (target.startsWith('0') && target.length === 8) target = '961' + target.slice(1);
    if (!target.startsWith('961') && target.length >= 7 && target.length <= 8) target = '961' + target;

    // Always send template first - no prior WhatsApp session needed
    let sentVia = 'template';
    try {
      const tplRes = await fetch(baseUrl + '/whatsapp/1/message/template', {
        method: 'POST',
        headers: { 'Authorization': 'App ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ messages: [{ from: sender, to: target, content: { templateName: 'order_confirmation', templateData: { body: { placeholders: [String(order.id), driverText] } }, language: 'en' } }] })
      });
      const tplData = await tplRes.json().catch(() => ({}));
      const tplStatus = tplData && tplData.messages && tplData.messages[0] ? tplData.messages[0].status : null;
      console.log('[driver_scan] Template result:', tplRes.status, tplStatus && tplStatus.name);
      if (!tplRes.ok || (tplStatus && tplStatus.groupId === 2)) {
        sentVia = 'text_fallback';
        await fetch(baseUrl + '/whatsapp/1/message/text', {
          method: 'POST',
          headers: { 'Authorization': 'App ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ from: sender, to: target, content: { text: driverText } })
        });
      }
    } catch (e) {
      console.error('[driver_scan] Dispatch error:', e);
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
