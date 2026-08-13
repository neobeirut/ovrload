document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let editingProductId = null;

  // Dashboard DOM Elements
  const inventoryTbody = document.getElementById('inventory-tbody');
  const logoutBtn = document.getElementById('logout-btn');
  const openAddBtn = document.getElementById('open-add-btn');

  // Modal DOM Elements
  const productModal = document.getElementById('product-modal');
  const modalTitle = document.getElementById('modal-title');
  const productForm = document.getElementById('product-form');
  const prodName = document.getElementById('prod-name');
  const prodCategory = document.getElementById('prod-category');
  const prodPrice = document.getElementById('prod-price');
  const prodImage = document.getElementById('prod-image');
  const prodSort = document.getElementById('prod-sort');
  const prodDesc = document.getElementById('prod-desc');
  const formError = document.getElementById('form-error');
  const cancelModalBtn = document.getElementById('cancel-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const categoriesList = document.getElementById('categories-list');

  // Categories Modal DOM Elements
  const openCategoriesBtn = document.getElementById('open-categories-btn');
  const categoriesModal = document.getElementById('categories-modal');
  const closeCategoriesModalBtn = document.getElementById('close-categories-modal-btn');
  const closeCategoriesDoneBtn = document.getElementById('close-categories-done-btn');
  const categoriesSortList = document.getElementById('categories-sort-list');

  // Handle Logout
  logoutBtn.addEventListener('click', () => {
    // Clear cookies client-side
    document.cookie = 'admin_passcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = 'login';
  });

  // Fetch and Load Inventory
  async function loadInventory() {
    inventoryTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Loading inventory...</td></tr>`;
    try {
      const res = await fetch('api/products');
      if (res.ok) {
        products = await res.json();
        renderInventory();
        populateCategoryDatalist();
      } else {
        inventoryTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Failed to fetch inventory.</td></tr>`;
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      inventoryTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Connection error.</td></tr>`;
    }
  }

  // Render Inventory Table rows
  function renderInventory() {
    if (products.length > 0) {
      inventoryTbody.innerHTML = products.map(product => `
        <tr class="admin-tr">
          <td class="admin-td">
            ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" class="table-thumb" alt="${escapeHtml(product.name)}">` : `<span style="color: var(--text-tertiary); font-size: 0.75rem; font-style: italic;">No Image</span>`}
          </td>
          <td class="admin-td" style="font-weight: 700;">${escapeHtml(product.name)}</td>
          <td class="admin-td">
            <span class="td-category" style="display: inline-block; padding: 0.2rem 0.5rem; border-radius: 4px; background: rgba(255,255,255,0.05); font-size: 0.75rem; font-weight: 600;">
              ${escapeHtml(product.category)}
            </span>
          </td>
          <td class="admin-td" style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${product.description ? escapeHtml(product.description) : '<span style="color: var(--text-tertiary); font-style: italic;">No description</span>'}
          </td>
          <td class="admin-td" style="font-weight: 700; color: var(--primary);">$${product.unit_price_usd.toFixed(2)}</td>
          <td class="admin-td" style="font-weight: 500;">${product.sort_order || 0}</td>
          <td class="admin-td" style="text-align: right;">
            <div class="admin-actions" style="justify-content: flex-end;">
              <button class="action-btn action-btn-edit" data-id="${product.id}" title="Edit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="action-btn action-btn-delete" data-id="${product.id}" data-name="${escapeHtml(product.name)}" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      // Attach click handlers
      inventoryTbody.querySelectorAll('.action-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = products.find(p => p.id === id);
          if (product) openEditModal(product);
        });
      });

      inventoryTbody.querySelectorAll('.action-btn-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          handleDelete(id, name);
        });
      });

    } else {
      inventoryTbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 4rem 2rem; text-align: center; color: var(--text-secondary);">
            Inventory is empty. Start by adding a product!
          </td>
        </tr>
      `;
    }
  }

  // Modal Management
  openAddBtn.addEventListener('click', () => {
    editingProductId = null;
    modalTitle.textContent = 'Add New Product';
    productForm.reset();
    prodImage.value = '';
    prodSort.value = '0';
    formError.style.display = 'none';
    productModal.style.display = 'flex';
    prodName.focus();
  });

  function openEditModal(product) {
    editingProductId = product.id;
    modalTitle.textContent = 'Edit Product';
    prodName.value = product.name;
    prodCategory.value = product.category;
    prodPrice.value = product.unit_price_usd;
    prodImage.value = product.image_url || '';
    prodSort.value = product.sort_order !== undefined ? product.sort_order : '0';
    prodDesc.value = product.description || '';
    formError.style.display = 'none';
    productModal.style.display = 'flex';
    prodName.focus();
  }

  function closeModal() {
    productModal.style.display = 'none';
  }

  cancelModalBtn.addEventListener('click', closeModal);
  closeModalBtn.addEventListener('click', closeModal);

  // Submit form logic (Add or Edit)
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.style.display = 'none';

    const name = prodName.value.trim();
    const category = prodCategory.value.trim();
    const priceVal = parseFloat(prodPrice.value);
    const imageUrl = prodImage.value.trim();
    const sortVal = parseInt(prodSort.value, 10);
    const sortOrder = isNaN(sortVal) ? 0 : sortVal;
    const description = prodDesc.value.trim();

    if (!name || !category || isNaN(priceVal) || priceVal < 0) {
      formError.textContent = 'Please fill in all fields with valid details.';
      formError.style.display = 'block';
      return;
    }

    const payload = { name, category, unit_price_usd: priceVal, image_url: imageUrl, sort_order: sortOrder, description };

    try {
      const url = editingProductId ? `api/products/${editingProductId}` : 'api/products';
      const method = editingProductId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        closeModal();
        loadInventory();
      } else {
        const data = await res.json();
        formError.textContent = data.error || 'Failed to save product.';
        formError.style.display = 'block';
      }
    } catch (err) {
      formError.textContent = 'Connection error. Please try again.';
      formError.style.display = 'block';
    }
  });



  // Delete product logic
  async function handleDelete(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const res = await fetch(`api/products/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        loadInventory();
      } else {
        alert('Failed to delete product.');
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Connection error while deleting product.');
    }
  }

  // Autocomplete Datalist population
  function populateCategoryDatalist() {
    const uniqueCats = [...new Set(products.map(p => p.category))];
    categoriesList.innerHTML = uniqueCats.map(cat => `
      <option value="${escapeHtml(cat)}"></option>
    `).join('');
  }

  // Category Ordering Modal Event Handlers
  openCategoriesBtn.addEventListener('click', () => {
    categoriesModal.style.display = 'flex';
    loadCategoriesSortList();
  });

  function closeCategoriesModal() {
    categoriesModal.style.display = 'none';
  }

  closeCategoriesModalBtn.addEventListener('click', closeCategoriesModal);
  closeCategoriesDoneBtn.addEventListener('click', closeCategoriesModal);
  categoriesModal.addEventListener('click', (e) => {
    if (e.target === categoriesModal) closeCategoriesModal();
  });

  async function loadCategoriesSortList() {
    categoriesSortList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">Loading categories...</p>';
    try {
      const res = await fetch('api/categories');
      const categoryOrders = await res.json();
      const orderMap = {};
      categoryOrders.forEach(c => {
        orderMap[c.name.toLowerCase()] = c.sort_order;
      });

      const uniqueCats = [...new Set(products.map(p => p.category))].filter(c => c && c.trim() !== '');
      
      if (uniqueCats.length === 0) {
        categoriesSortList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">No categories found in products. Create a product first!</p>';
        return;
      }

      categoriesSortList.innerHTML = uniqueCats.map(cat => {
        const currentOrder = orderMap[cat.toLowerCase()] !== undefined ? orderMap[cat.toLowerCase()] : 0;
        // Escape quotes safely in data attribute
        const escapedCat = cat.replace(/"/g, '&quot;');
        return `
          <div class="category-sort-row" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">${escapeHtml(cat)}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <input type="number" value="${currentOrder}" class="form-input category-sort-input" data-category="${escapedCat}" style="width: 70px; padding: 0.4rem; margin: 0; text-align: center; font-size: 0.9rem;">
              <button class="action-btn save-cat-btn" data-category="${escapedCat}" style="background: var(--primary); padding: 0.4rem 0.8rem; border-radius: 4px; color: white; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; font-size: 0.85rem; font-weight: 700; height: 32px;" title="Save Order">
                Save
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Attach save handlers
      categoriesSortList.querySelectorAll('.save-cat-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const catName = btn.getAttribute('data-category');
          // Escape quotes in selector
          const selectorSafeName = catName.replace(/"/g, '\\"');
          const input = categoriesSortList.querySelector(`.category-sort-input[data-category="${selectorSafeName}"]`);
          const sortOrder = parseInt(input.value, 10) || 0;
          await saveCategoryOrder(catName, sortOrder, btn);
        });
      });

    } catch (err) {
      console.error('Error loading category list:', err);
      categoriesSortList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0;">Error loading list.</p>';
    }
  }

  async function saveCategoryOrder(name, sort_order, buttonEl) {
    buttonEl.textContent = '...';
    buttonEl.disabled = true;
    try {
      const res = await fetch('api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sort_order })
      });
      if (res.ok) {
        buttonEl.textContent = 'Saved! ✓';
        buttonEl.style.background = '#28a745';
        setTimeout(() => {
          buttonEl.textContent = 'Save';
          buttonEl.style.background = 'var(--primary)';
          buttonEl.disabled = false;
        }, 1500);
        loadInventory(); // Reload inventory
      } else {
        alert('Failed to save category order.');
        buttonEl.textContent = 'Save';
        buttonEl.disabled = false;
      }
    } catch (err) {
      console.error('Error saving category order:', err);
      alert('Connection error.');
      buttonEl.textContent = 'Save';
      buttonEl.disabled = false;
    }
  }

  // HTML Special Character escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }


  // ── Tab Switching ─────────────────────────────────────────────
  const tabInventoryBtn  = document.getElementById('tab-inventory-btn');
  const tabDispatchBtn   = document.getElementById('tab-dispatch-btn');
  const dashboardLayout  = document.getElementById('dashboard-layout');
  const dispatchPanel    = document.getElementById('dispatch-panel');

  tabInventoryBtn.addEventListener('click', () => {
    dashboardLayout.style.display = '';
    dispatchPanel.style.display   = 'none';
    tabInventoryBtn.classList.add('admin-tab-active');
    tabDispatchBtn.classList.remove('admin-tab-active');
  });

  tabDispatchBtn.addEventListener('click', () => {
    dashboardLayout.style.display = 'none';
    dispatchPanel.style.display   = '';
    tabDispatchBtn.classList.add('admin-tab-active');
    tabInventoryBtn.classList.remove('admin-tab-active');
    loadDispatchOrders();
  });

  document.getElementById('dispatch-refresh-btn').addEventListener('click', loadDispatchOrders);

  // ── Dispatch Order Loading ────────────────────────────────────
  async function loadDispatchOrders() {
    const list = document.getElementById('dispatch-orders-list');
    const stamp = document.getElementById('dispatch-last-refresh');
    list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-secondary);">Loading orders...</div>`;
    try {
      const res  = await fetch('api/orders/pending-delivery');
      const orders = res.ok ? await res.json() : [];
      stamp.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
      renderDispatchOrders(orders);
    } catch (e) {
      list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-secondary);">Connection error — check server.</div>`;
    }
  }

  function timeAgo(isoString) {
    const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
    if (diff < 60)  return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  }

  function renderDispatchOrders(orders) {
    const list = document.getElementById('dispatch-orders-list');
    if (!orders.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:4rem 2rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🛵</div>
          <div style="color:var(--text-secondary);font-size:1rem;">No pending delivery orders right now.</div>
        </div>`;
      return;
    }
    list.innerHTML = orders.map(o => {
      const cleanAddr = (o.delivery_address || 'No address').replace(/\[Maps Pin:.*?\]/gi, '').trim();
      const items = (o.items || []).map(i => `${i.quantity}x ${i.product_name || 'Item'}`).join(' • ') || '—';
      const badgeClass = o.status === 'ready' ? 'dispatch-badge-ready' : o.status === 'confirmed' ? 'dispatch-badge-confirmed' : 'dispatch-badge-pending';
      const badgeLabel = o.status === 'ready' ? '✓ Ready' : o.status === 'confirmed' ? '● Confirmed' : '⏳ Pending';
      return `
        <div class="dispatch-card">
          <div class="dispatch-card-info">
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:4px;">
              <span class="dispatch-card-id">#${o.id}</span>
              <span class="dispatch-badge ${badgeClass}">${badgeLabel}</span>
              <span style="font-size:0.75rem;color:var(--text-tertiary);">${timeAgo(o.created_at)}</span>
            </div>
            <div class="dispatch-card-customer">👤 ${escapeHtml(o.customer_name || 'Customer')} — ${escapeHtml(o.customer_phone || '')}</div>
            <div class="dispatch-card-address">📍 ${escapeHtml(cleanAddr)}</div>
            <div class="dispatch-card-items">🛒 ${escapeHtml(items)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.6rem;">
            <span class="dispatch-total">$${Number(o.total_amount || 0).toFixed(2)}</span>
            <button class="dispatch-qr-btn" onclick="showDriverQR(${o.id})">📱 Show QR</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── QR Modal ──────────────────────────────────────────────────
  const qrModal      = document.getElementById('qr-modal');
  const qrCanvas     = document.getElementById('qr-canvas');
  const qrTitle      = document.getElementById('qr-order-title');
  const qrCustomer   = document.getElementById('qr-order-customer');
  const qrCloseBtn   = document.getElementById('qr-close-btn');
  const qrPickupBtn  = document.getElementById('qr-pickup-btn');
  let   currentQROrderId = null;

  window.showDriverQR = function(orderId) {
    currentQROrderId = orderId;
    const url = `https://ovrload-nine.vercel.app/driver/scan?orderId=${orderId}`;

    // Find order from rendered list
    fetch(`api/orders/${orderId}`)
      .then(r => r.ok ? r.json() : {})
      .then(o => {
        qrTitle.textContent    = `Order #${orderId}`;
        qrCustomer.textContent = `${o.customer_name || 'Customer'} — ${o.customer_phone || ''} | $${Number(o.total_amount||0).toFixed(2)}`;
      })
      .catch(() => { qrTitle.textContent = `Order #${orderId}`; });

    // Generate QR
    qrCanvas.innerHTML = '';
    new QRCode(qrCanvas, {
      text:         url,
      width:        220,
      height:       220,
      colorDark:    '#000000',
      colorLight:   '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    qrModal.style.display = 'flex';
  };

  qrCloseBtn.addEventListener('click', () => {
    qrModal.style.display = 'none';
    currentQROrderId = null;
  });

  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) { qrModal.style.display = 'none'; currentQROrderId = null; }
  });

  qrPickupBtn.addEventListener('click', async () => {
    if (!currentQROrderId) return;
    qrPickupBtn.textContent = 'Updating...';
    qrPickupBtn.disabled = true;
    try {
      const res = await fetch(`api/orders/${currentQROrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'delivered' })
      });
      if (res.ok) {
        qrModal.style.display = 'none';
        currentQROrderId = null;
        loadDispatchOrders(); // Refresh list
      } else {
        alert('Failed to update order status.');
      }
    } catch (e) {
      alert('Connection error.');
    } finally {
      qrPickupBtn.textContent = '✅ Mark as Picked Up';
      qrPickupBtn.disabled = false;
    }
  });

  // Auto-refresh dispatch every 30s when tab is active
  setInterval(() => {
    if (dispatchPanel.style.display !== 'none') loadDispatchOrders();
  }, 30000);

  // ── Category Report Logic ────────────────────────────────────
  const refreshCategoryReportBtn = document.getElementById('refresh-category-report-btn');
  const categoryReportTbody = document.getElementById('category-report-tbody');
  const kpiProducts = document.getElementById('kpi-report-products');
  const kpiInvAmount = document.getElementById('kpi-report-inv-amount');
  const kpiItemsSold = document.getElementById('kpi-report-items-sold');
  const kpiSalesAmount = document.getElementById('kpi-report-sales-amount');

  async function loadCategoryReport() {
    if (!categoryReportTbody) return;
    categoryReportTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">Loading category report...</td></tr>`;

    try {
      const res = await fetch('api/reports/category-summary');
      if (!res.ok) {
        categoryReportTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">Failed to load report data.</td></tr>`;
        return;
      }

      const data = await res.json();
      const { categories, totals } = data;

      // Update KPI metrics
      if (kpiProducts) kpiProducts.textContent = totals.total_products || 0;
      if (kpiInvAmount) kpiInvAmount.textContent = `$${Number(totals.total_inventory_amount || 0).toFixed(2)}`;
      if (kpiItemsSold) kpiItemsSold.textContent = totals.total_items_sold || 0;
      if (kpiSalesAmount) kpiSalesAmount.textContent = `$${Number(totals.total_sales_amount || 0).toFixed(2)}`;

      if (!categories || categories.length === 0) {
        categoryReportTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">No category report data available.</td></tr>`;
        return;
      }

      categoryReportTbody.innerHTML = categories.map(cat => {
        const sharePct = totals.total_sales_amount > 0 
          ? Math.round((cat.total_sales_amount / totals.total_sales_amount) * 100) 
          : 0;

        return `
          <tr class="admin-tr">
            <td class="admin-td" style="font-weight: 700;">
              <span class="td-category" style="display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; background: rgba(255,255,255,0.06); font-size: 0.8rem; font-weight: 700;">
                ${escapeHtml(cat.category)}
              </span>
            </td>
            <td class="admin-td" style="text-align: center; font-weight: 600;">${cat.total_products}</td>
            <td class="admin-td" style="text-align: right; font-weight: 600; color: #17a2b8;">$${Number(cat.total_inventory_amount).toFixed(2)}</td>
            <td class="admin-td" style="text-align: center; font-weight: 700; color: var(--primary);">${cat.total_items_sold}</td>
            <td class="admin-td" style="text-align: right; font-weight: 700; color: #28a745;">$${Number(cat.total_sales_amount).toFixed(2)}</td>
            <td class="admin-td" style="text-align: center;">
              <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                <div style="flex: 1; background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden; max-width: 70px;">
                  <div style="width: ${sharePct}%; background: var(--primary); height: 100%; border-radius: 3px;"></div>
                </div>
                <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); width: 30px;">${sharePct}%</span>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      console.error('Error loading category report:', err);
      categoryReportTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-secondary);">Connection error loading report.</td></tr>`;
    }
  }

  if (refreshCategoryReportBtn) {
    refreshCategoryReportBtn.addEventListener('click', loadCategoryReport);
  }

  loadInventory();
  loadCategoryReport();
});


