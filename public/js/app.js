document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let selectedCategory = 'All';
  let searchQuery = '';
  
  // Shopping Cart & Order settings state
  let cart = JSON.parse(localStorage.getItem('ovrload_cart')) || [];
  let orderType = 'pickup';
  let deliveryCost = 0.00;
  let discountPercent = 15.00;
  let currentProductInDrawer = null;
  let drawerQty = 1;
  let userCoords = null;

  // DOM Elements
  const productList = document.getElementById('product-list');
  const categoryScroller = document.getElementById('category-scroller');
  const detailOverlay = document.getElementById('detail-overlay');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerPrice = document.getElementById('drawer-price');
  const drawerCategory = document.getElementById('drawer-category');
  const drawerDesc = document.getElementById('drawer-desc');
  const drawerImage = document.getElementById('drawer-image');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const drawerCustomizations = document.getElementById('drawer-customizations');

  // Quantity elements in details drawer
  const detailQtyVal = document.getElementById('detail-qty-val');
  const detailQtyMinus = document.getElementById('detail-qty-minus');
  const detailQtyPlus = document.getElementById('detail-qty-plus');
  const addToCartBtn = document.getElementById('add-to-cart-btn');

  function areCustomizationsEqual(c1, c2) {
    if (!c1 && !c2) return true;
    if (!c1 || !c2) return false;
    if (c1.length !== c2.length) return false;
    for (let i = 0; i < c1.length; i++) {
      if (c1[i].id !== c2[i].id) return false;
    }
    return true;
  }

  // Cart Preview Bar elements
  const cartPreviewBar = document.getElementById('cart-preview-bar');
  const cartPreviewCount = document.getElementById('cart-preview-count');
  const cartPreviewTotal = document.getElementById('cart-preview-total');
  const btnViewCart = document.getElementById('btn-view-cart');

  // Cart Drawer elements
  const cartOverlay = document.getElementById('cart-overlay');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSubtotal = document.getElementById('cart-subtotal');
  const cartDiscountRow = document.getElementById('cart-discount-row');
  const cartDiscountPercent = document.getElementById('cart-discount-percent');
  const cartDiscountVal = document.getElementById('cart-discount-val');
  const cartDeliveryVal = document.getElementById('cart-delivery-val');
  const cartTotalVal = document.getElementById('cart-total-val');

  // Form elements
  const checkoutForm = document.getElementById('checkout-form');
  const orderName = document.getElementById('order-name');
  const orderPhone = document.getElementById('order-phone');
  const orderLocation = document.getElementById('order-location');
  const orderLocationGroup = document.getElementById('order-location-group');
  const btnTypePickup = document.getElementById('btn-type-pickup');
  const btnTypeDelivery = document.getElementById('btn-type-delivery');
  const orderTimeType = document.getElementById('order-time-type');
  const scheduledTimeGroup = document.getElementById('scheduled-time-group');
  const orderTime = document.getElementById('order-time');
  const btnGpsLocation = document.getElementById('btn-gps-location');
  
  // Order Type Toggle Handlers (Pickup on the LEFT, Delivery on the RIGHT)
  if (btnTypePickup && btnTypeDelivery) {
    btnTypePickup.addEventListener('click', () => {
      orderType = 'pickup';
      deliveryCost = 0.00;
      btnTypePickup.classList.add('active');
      btnTypeDelivery.classList.remove('active');
      if (orderLocationGroup) orderLocationGroup.style.display = 'none';
      if (orderLocation) orderLocation.required = false;
      renderCart();
    });

    btnTypeDelivery.addEventListener('click', () => {
      orderType = 'delivery';
      btnTypeDelivery.classList.add('active');
      btnTypePickup.classList.remove('active');
      if (orderLocationGroup) orderLocationGroup.style.display = 'block';
      if (orderLocation) orderLocation.required = true;
      if (userCoords) {
        recalculateDelivery(userCoords.lat, userCoords.lng);
      } else {
        deliveryCost = 0.00;
        renderCart();
      }
    });
  }

  // Set copyright year
  document.getElementById('year').textContent = new Date().getFullYear();

  // Load backend order settings
  async function loadOrderSettings() {
    try {
      const res = await fetch('api/order-settings');
      if (res.ok) {
        const settings = await res.json();
        deliveryCost = settings.deliveryCost;
        discountPercent = settings.discountPercent;
        renderCart();
      }
    } catch (err) {
      console.error('Error fetching order settings:', err);
    }
  }



  // Load products
  async function loadProducts() {
    try {
      const res = await fetch('api/products');
      if (res.ok) {
        products = await res.json();
        
        // Fallback to 'All' if the default category is not found in database products
        const hasDefaultCategory = products.some(p => p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());
        if (!hasDefaultCategory) {
          selectedCategory = 'All';
        }

        renderCategories();
        renderProducts();
      } else {
        productList.innerHTML = '<p class="no-products">Failed to load lineup.</p>';
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      productList.innerHTML = '<p class="no-products">Connection error.</p>';
    }
  }

  // Render categories pills dynamically
  function renderCategories() {
    const uniqueCategories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
    categoryScroller.innerHTML = uniqueCategories.map(cat => `
      <button class="category-tab ${cat.toLowerCase() === selectedCategory.toLowerCase() ? 'active' : ''}" data-category="${cat}">
        ${cat}
      </button>
    `).join('');

    // Attach click events
    categoryScroller.querySelectorAll('.category-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        selectedCategory = tab.getAttribute('data-category');
        categoryScroller.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderProducts();
      });
    });
  }

  // Render product lineup
  function renderProducts() {
    const filtered = products.filter(product => {
      const matchesCategory = selectedCategory === 'All' || (product.category && product.category.toLowerCase() === selectedCategory.toLowerCase());
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (product.description && product.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    if (filtered.length > 0) {
      productList.innerHTML = filtered.map(product => `
        <article class="product-card glass" data-id="${product.id}">
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" class="card-img" alt="${escapeHtml(product.name)}">` : ''}
          <div class="card-header">
            <h2 class="card-title">${escapeHtml(product.name)}</h2>
            <span class="card-category">${escapeHtml(product.category)}</span>
          </div>
          ${product.description ? `<p class="card-description">${escapeHtml(product.description)}</p>` : ''}
          <div class="product-card-footer">
            <span class="card-price">$${product.unit_price_usd.toFixed(2)}</span>
            <button type="button" class="btn-quick-add" data-id="${product.id}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add
            </button>
          </div>
        </article>
      `).join('');

      // Attach detail drawer click events
      productList.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = parseInt(card.getAttribute('data-id'));
          const product = products.find(p => p.id === id);
          if (product) openDrawer(product);
        });
      });

      // Attach quick add button click events
      productList.querySelectorAll('.btn-quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering card click (opening drawer)
          const id = parseInt(btn.getAttribute('data-id'));
          const product = products.find(p => p.id === id);
          if (!product) return;

          // If the product has customizations, we must open the drawer so they can choose options
          if (product.customizations && product.customizations.length > 0) {
            openDrawer(product);
          } else {
            // Add directly to cart
            const existingIndex = cart.findIndex(item => item.id === product.id && (!item.customizations || item.customizations.length === 0));
            if (existingIndex > -1) {
              cart[existingIndex].qty += 1;
            } else {
              cart.push({
                id: product.id,
                name: product.name,
                unit_price_usd: product.unit_price_usd,
                image_url: product.image_url,
                qty: 1,
                customizations: []
              });
            }
            saveCart();
            renderCart();
            
            // Animate floating cart preview bar for visual feedback
            const bar = document.getElementById('cart-preview-bar');
            if (bar) {
              bar.style.transform = 'translateX(-50%) scale(1.05)';
              setTimeout(() => {
                bar.style.transform = 'translateX(-50%) scale(1)';
              }, 150);
            }
          }
        });
      });
    } else {
      productList.innerHTML = `
        <div class="no-products">
          <div class="no-products-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>
          <p>No items found matching "${escapeHtml(searchQuery)}"</p>
        </div>
      `;
    }
  }

  // Drawer modal management
  function openDrawer(product) {
    currentProductInDrawer = product;
    drawerQty = 1;
    detailQtyVal.textContent = drawerQty;

    drawerTitle.textContent = product.name;
    drawerCategory.textContent = product.category;
    drawerDesc.textContent = product.description || 'No additional details provided.';
    
    if (product.image_url) {
      drawerImage.src = product.image_url;
      drawerImage.alt = product.name;
      drawerImage.style.display = 'block';
    } else {
      drawerImage.src = '';
      drawerImage.style.display = 'none';
    }
    
    // Render customizations
    drawerCustomizations.innerHTML = '';
    if (product.customizations && product.customizations.length > 0) {
      const groups = {};
      product.customizations.forEach(c => {
        let groupName = c.option_group_name;
        if (!groupName) {
          if (c.customization_type === 'remove') {
            groupName = 'Remove Ingredients';
          } else {
            groupName = 'Custom Options';
          }
        }
        if (!groups[groupName]) {
          groups[groupName] = [];
        }
        groups[groupName].push(c);
      });

      for (const [groupName, options] of Object.entries(groups)) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'customization-group';

        const title = document.createElement('div');
        title.className = 'customization-group-title';
        title.textContent = groupName;
        groupDiv.appendChild(title);

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'customization-options';

        const isMultiSelect = options[0].is_multi_select || groupName === 'Remove Ingredients';
        const inputType = isMultiSelect ? 'checkbox' : 'radio';
        const radioGroupName = `custom-group-${groupName.replace(/\s+/g, '-').toLowerCase()}`;

        options.forEach(opt => {
          const optId = `opt-${opt.id}`;
          
          const input = document.createElement('input');
          input.className = 'custom-option-input';
          input.type = inputType;
          input.id = optId;
          input.name = isMultiSelect ? optId : radioGroupName;
          input.value = opt.id;
          input.dataset.name = opt.name;
          input.dataset.price = opt.price || 0;
          input.dataset.type = opt.customization_type;
          input.dataset.group = groupName;

          if (!isMultiSelect && opt.is_default) {
            input.checked = true;
          }

          const label = document.createElement('label');
          label.className = 'custom-option-label';
          label.htmlFor = optId;

          const textSpan = document.createElement('span');
          if (opt.customization_type === 'remove') {
            textSpan.textContent = `No ${opt.name}`;
          } else {
            textSpan.textContent = opt.name;
          }
          label.appendChild(textSpan);

          if (opt.price > 0) {
            const priceSpan = document.createElement('span');
            priceSpan.className = 'custom-option-price';
            priceSpan.textContent = `(+$${opt.price.toFixed(2)})`;
            label.appendChild(priceSpan);
          }

          optionsDiv.appendChild(input);
          optionsDiv.appendChild(label);
          input.addEventListener('change', updateDrawerPrice);
        });

        if (!isMultiSelect) {
          const checked = optionsDiv.querySelector('input:checked');
          if (!checked && optionsDiv.querySelector('input')) {
            optionsDiv.querySelector('input').checked = true;
          }
        }

        groupDiv.appendChild(optionsDiv);
        drawerCustomizations.appendChild(groupDiv);
      }
    }
    
    updateDrawerPrice();
    detailOverlay.style.display = 'flex';
  }

  function updateDrawerPrice() {
    if (!currentProductInDrawer) return;

    let basePrice = currentProductInDrawer.unit_price_usd;
    let extraPrice = 0;

    const checkedInputs = drawerCustomizations.querySelectorAll('input:checked');
    checkedInputs.forEach(input => {
      const price = parseFloat(input.dataset.price || 0);
      extraPrice += price;
    });

    const totalPrice = (basePrice + extraPrice) * drawerQty;
    drawerPrice.textContent = `$${totalPrice.toFixed(2)}`;
  }

  function closeDrawer() {
    detailOverlay.style.animation = 'fadeIn 0.2s reverse'; // Quick fadeout animation
    setTimeout(() => {
      detailOverlay.style.display = 'none';
      detailOverlay.style.animation = ''; // Reset animation
    }, 200);
  }

  closeDrawerBtn.addEventListener('click', closeDrawer);
  detailOverlay.addEventListener('click', (e) => {
    if (e.target === detailOverlay) closeDrawer();
  });

  // Quantity modification in Details Drawer
  detailQtyMinus.addEventListener('click', () => {
    if (drawerQty > 1) {
      drawerQty--;
      detailQtyVal.textContent = drawerQty;
      updateDrawerPrice();
    }
  });

  detailQtyPlus.addEventListener('click', () => {
    drawerQty++;
    detailQtyVal.textContent = drawerQty;
    updateDrawerPrice();
  });

  // Add to Cart implementation
  addToCartBtn.addEventListener('click', () => {
    if (!currentProductInDrawer) return;

    const selectedCustomizations = [];
    const checkedInputs = drawerCustomizations.querySelectorAll('input:checked');
    checkedInputs.forEach(input => {
      selectedCustomizations.push({
        id: parseInt(input.value),
        name: input.dataset.name,
        price: parseFloat(input.dataset.price || 0),
        type: input.dataset.type,
        group: input.dataset.group
      });
    });
    selectedCustomizations.sort((a, b) => a.id - b.id);

    let extraPrice = 0;
    selectedCustomizations.forEach(c => extraPrice += c.price);
    const itemUnitPrice = currentProductInDrawer.unit_price_usd + extraPrice;

    const existingIndex = cart.findIndex(item => 
      item.id === currentProductInDrawer.id && 
      areCustomizationsEqual(item.customizations, selectedCustomizations)
    );

    if (existingIndex > -1) {
      cart[existingIndex].qty += drawerQty;
    } else {
      cart.push({
        id: currentProductInDrawer.id,
        name: currentProductInDrawer.name,
        category: currentProductInDrawer.category,
        image_url: currentProductInDrawer.image_url,
        unit_price_usd: itemUnitPrice,
        base_price_usd: currentProductInDrawer.unit_price_usd,
        qty: drawerQty,
        customizations: selectedCustomizations
      });
    }

    saveCart();
    renderCart();
    closeDrawer();

    // Subtle bounce animation on the cart preview bar
    cartPreviewBar.classList.add('bounce');
    setTimeout(() => cartPreviewBar.classList.remove('bounce'), 300);
  });

  // Cart operations
  function saveCart() {
    localStorage.setItem('ovrload_cart', JSON.stringify(cart));
  }

  function updateCartQuantity(index, delta) {
    const item = cart[index];
    if (item) {
      item.qty += delta;
      if (item.qty <= 0) {
        cart.splice(index, 1);
      }
      saveCart();
      renderCart();
    }
  }

  function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  }

  // Render cart details
  function renderCart() {
    let subtotal = 0;
    let totalItemsCount = 0;

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="no-products" style="padding: 2rem 0;">
          <div class="no-products-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </div>
          <p>Your cart is empty.</p>
        </div>
      `;
      cartPreviewBar.classList.remove('active');
      setTimeout(() => { if (cart.length === 0) cartPreviewBar.style.display = 'none'; }, 400);
    } else {
      cartPreviewBar.style.display = 'block';
      setTimeout(() => { if (cart.length > 0) cartPreviewBar.classList.add('active'); }, 50);

      cartItemsContainer.innerHTML = cart.map((item, index) => {
        subtotal += item.unit_price_usd * item.qty;
        totalItemsCount += item.qty;
        
        let customizationsText = '';
        if (item.customizations && item.customizations.length > 0) {
          const names = item.customizations.map(c => {
            if (c.type === 'remove') {
              return `No ${c.name}`;
            }
            return c.name;
          });
          customizationsText = `<div class="cart-item-customizations">${escapeHtml(names.join(', '))}</div>`;
        }
        
        return `
          <div class="cart-item">
            ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" class="cart-item-img" alt="${escapeHtml(item.name)}">` : ''}
            <div class="cart-item-details">
              <span class="cart-item-name">${escapeHtml(item.name)}</span>
              ${customizationsText}
              <span class="cart-item-price">$${(item.unit_price_usd * item.qty).toFixed(2)}</span>
            </div>
            <div class="cart-item-actions">
              <div class="cart-item-qty-selector">
                <button type="button" class="cart-item-qty-btn btn-minus" data-index="${index}">−</button>
                <span class="cart-item-qty-val">${item.qty}</span>
                <button type="button" class="cart-item-qty-btn btn-plus" data-index="${index}">+</button>
              </div>
              <button type="button" class="cart-item-delete-btn" data-index="${index}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Attach button handlers inside cart list
      cartItemsContainer.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          updateCartQuantity(index, -1);
        });
      });
      cartItemsContainer.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          updateCartQuantity(index, 1);
        });
      });
      cartItemsContainer.querySelectorAll('.cart-item-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const index = parseInt(btn.getAttribute('data-index'));
          removeFromCart(index);
        });
      });
    }

    // Calculations
    const effectiveDeliveryFee = orderType === 'delivery' ? deliveryCost : 0;
    const discountVal = discountPercent > 0 ? (subtotal * (discountPercent / 100)) : 0;
    const finalTotal = subtotal - discountVal + (cart.length > 0 ? effectiveDeliveryFee : 0);

    // Update Cost Summaries
    cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
    
    if (discountPercent > 0 && cart.length > 0) {
      cartDiscountPercent.textContent = discountPercent;
      cartDiscountVal.textContent = `-$${discountVal.toFixed(2)}`;
      cartDiscountRow.style.display = 'flex';
    } else {
      cartDiscountRow.style.display = 'none';
    }

    if (orderType === 'pickup') {
      cartDeliveryVal.textContent = '$0.00 (Pickup)';
    } else if (deliveryCost === 0) {
      cartDeliveryVal.textContent = '$0.00 (Pin location)';
    } else {
      cartDeliveryVal.textContent = `$${deliveryCost.toFixed(2)}`;
    }
    cartTotalVal.textContent = `$${finalTotal.toFixed(2)}`;

    // Update Floating bar values
    cartPreviewCount.textContent = totalItemsCount;
    cartPreviewTotal.textContent = `$${finalTotal.toFixed(2)}`;
  }

  // Cart Drawer open/close
  function toggleCartDrawer(isOpen) {
    if (isOpen) {
      cartOverlay.style.display = 'flex';
      renderCart();
    } else {
      cartOverlay.style.animation = 'fadeIn 0.2s reverse';
      setTimeout(() => {
        cartOverlay.style.display = 'none';
        cartOverlay.style.animation = '';
      }, 200);
    }
  }

  btnViewCart.addEventListener('click', () => toggleCartDrawer(true));
  closeCartBtn.addEventListener('click', () => toggleCartDrawer(false));
  cartOverlay.addEventListener('click', (e) => {
    if (e.target === cartOverlay) toggleCartDrawer(false);
  });

  // Helper to get minimum delivery time (current time + 45 minutes)
  function getMinDeliveryTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 45);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Scheduled Delivery Time Toggle
  orderTimeType.addEventListener('change', () => {
    if (orderTimeType.value === 'scheduled') {
      scheduledTimeGroup.style.display = 'flex';
      orderTime.required = true;
      const minTime = getMinDeliveryTime();
      orderTime.min = minTime;
      orderTime.value = minTime;
    } else {
      scheduledTimeGroup.style.display = 'none';
      orderTime.required = false;
      orderTime.value = '';
      orderTime.removeAttribute('min');
    }
  });

  // Dynamic Delivery Cost Recalculation
  async function recalculateDelivery(lat, lng) {
    try {
      const res = await fetch('api/calculate-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lng })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.inDeliveryZone) {
          deliveryCost = data.fee;
          renderCart();
          
          if (btnGpsLocation) {
            btnGpsLocation.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Location Pinned!
            `;
            btnGpsLocation.style.background = 'rgba(37, 211, 102, 0.08)';
            btnGpsLocation.style.borderColor = 'rgba(37, 211, 102, 0.25)';
            btnGpsLocation.style.color = '#25d366';
          }
        } else {
          alert(data.error || 'Your address is outside our delivery zone.');
          userCoords = null;
          // Clear map pin
          orderLocation.value = orderLocation.value.replace(/\[Maps Pin: [^\]]+\]/, '').trim();
          if (btnGpsLocation) {
            btnGpsLocation.style.background = '';
            btnGpsLocation.style.borderColor = '';
            btnGpsLocation.style.color = '';
            btnGpsLocation.innerHTML = `
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Pin GPS Location
            `;
          }
          loadOrderSettings();
        }
      }
    } catch (err) {
      console.error('Error recalculating delivery:', err);
    }
  }

  // Address manual editing clears coordinates if map pin is deleted
  orderLocation.addEventListener('input', () => {
    const val = orderLocation.value;
    if (!val.includes('[Maps Pin:')) {
      userCoords = null;
      if (btnGpsLocation) {
        btnGpsLocation.style.background = '';
        btnGpsLocation.style.borderColor = '';
        btnGpsLocation.style.color = '';
        btnGpsLocation.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          Pin GPS Location
        `;
      }
      loadOrderSettings();
    }
  });

  // GPS Location Pinning
  if (btnGpsLocation) {
    btnGpsLocation.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      btnGpsLocation.classList.add('loading');
      btnGpsLocation.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        Locating...
      `;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          userCoords = { lat, lng };
          const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
          
          // Append location URL to text address area
          let cleanVal = orderLocation.value.replace(/\[Maps Pin: [^\]]+\]/, '').trim();
          const separator = cleanVal ? '\n\n' : '';
          orderLocation.value = `${cleanVal}${separator}[Maps Pin: ${mapUrl}]`;
          
          btnGpsLocation.classList.remove('loading');
          
          // Recalculate cost
          recalculateDelivery(lat, lng);
          saveUserInfo();
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Could not retrieve your location. Please check your browser permissions.');
          btnGpsLocation.classList.remove('loading');
          btnGpsLocation.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle; display: inline-block;">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            Pin GPS Location
          `;
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  // LocalStorage User Information management
  function loadUserInfo() {
    const savedName = localStorage.getItem('ovrload_user_name');
    const savedPhone = localStorage.getItem('ovrload_user_phone');
    const savedLoc = localStorage.getItem('ovrload_user_location');

    if (savedName) orderName.value = savedName;
    if (savedPhone) orderPhone.value = savedPhone;
    if (savedLoc) {
      orderLocation.value = savedLoc;
      // Extract coordinates if present
      const match = savedLoc.match(/\[Maps Pin: https:\/\/www.google.com\/maps\?q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\]/);
      if (match) {
        userCoords = {
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2])
        };
        recalculateDelivery(userCoords.lat, userCoords.lng);
      }
    }
  }

  function saveUserInfo() {
    localStorage.setItem('ovrload_user_name', orderName.value);
    localStorage.setItem('ovrload_user_phone', orderPhone.value);
    localStorage.setItem('ovrload_user_location', orderLocation.value);
  }

  // Format order description and customer info into WhatsApp format
  function getWhatsAppUrl() {
    const name = orderName.value.trim();
    const phone = orderPhone.value.trim();
    const location = orderLocation.value.trim();
    const timeType = orderTimeType.value;
    const timeVal = orderTime.value;
    
    const deliveryTime = timeType === 'asap' ? 'ASAP' : `Scheduled for ${timeVal}`;

    let subTotal = 0;
    let itemsText = '';
    
    cart.forEach(item => {
      const itemTotal = item.unit_price_usd * item.qty;
      subTotal += itemTotal;
      
      let custDesc = '';
      if (item.customizations && item.customizations.length > 0) {
        const names = item.customizations.map(c => {
          if (c.type === 'remove') {
            return `No ${c.name}`;
          }
          if (c.price > 0) {
            return `${c.name} (+$${c.price})`;
          }
          return c.name;
        });
        custDesc = `   \u2514 _Options: ${names.join(', ')}_\r\n`;
      }
      itemsText += `\u2022 ${item.qty}x *${item.name}*\r\n${custDesc}`;
    });

    const effectiveDeliveryFee = orderType === 'delivery' ? deliveryCost : 0;
    const discountVal = discountPercent > 0 ? (subTotal * (discountPercent / 100)) : 0;
    const totalVal = subTotal - discountVal + effectiveDeliveryFee;

    let text = `\uD83C\uDF54 *NEW ORDER - OVR LOAD*\r\n`;
    text += `================================\r\n\r\n`;
    text += `*Customer Details:*\r\n`;
    text += `\u2022 *Name:* ${name}\r\n`;
    text += `\u2022 *Phone:* ${phone}\r\n`;
    text += `\u2022 *Order Type:* ${orderType === 'pickup' ? 'Pickup' : 'Delivery'}\r\n`;
    if (orderType === 'delivery' && location) {
      text += `\u2022 *Delivery Address:* ${location}\r\n`;
    }
    text += `\u2022 *Requested Time:* ${deliveryTime}\r\n\r\n`;
    
    text += `*Items Ordered:*\r\n`;
    text += itemsText + `\r\n`;
    
    text += `*Payment Summary:*\r\n`;
    text += `\u2022 *Subtotal:* $${subTotal.toFixed(2)}\r\n`;
    if (discountPercent > 0) {
      text += `\u2022 *WhatsApp Discount (${discountPercent}%):* -$${discountVal.toFixed(2)}\r\n`;
    }
    text += `\u2022 *Delivery Fee:* $${effectiveDeliveryFee.toFixed(2)}\r\n`;
    text += `\u2022 *Total Amount:* $${totalVal.toFixed(2)}`;

    return `https://api.whatsapp.com/send?phone=96181202607&text=${encodeURIComponent(text)}`;
  }

  // Handle Form Submit / Checkout
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    if (orderType === 'delivery' && !orderLocation.value.trim()) {
      alert("Please enter your delivery address.");
      return;
    }

    if (orderTimeType.value === 'scheduled' && orderTime.value) {
      const minTime = getMinDeliveryTime();
      if (orderTime.value < minTime) {
        alert(`Please select a delivery time that is at least 45 minutes from now (after ${minTime}).`);
        return;
      }
    }

    saveUserInfo();

    const name = orderName.value.trim();
    const phone = orderPhone.value.trim();
    const location = orderLocation.value.trim();
    const timeType = orderTimeType.value;
    const timeVal = orderTime.value;
    const deliveryTime = timeType === 'asap' ? 'ASAP' : `Scheduled for ${timeVal}`;

    // Calculate totals for DB save
    let subTotal = 0;
    cart.forEach(item => { subTotal += item.unit_price_usd * item.qty; });
    const effectiveDeliveryFee = orderType === 'delivery' ? deliveryCost : 0;
    const discountVal = discountPercent > 0 ? (subTotal * (discountPercent / 100)) : 0;
    const totalVal = subTotal - discountVal + effectiveDeliveryFee;

    // Save order to DB (non-blocking — WhatsApp opens regardless)
    try {
      await fetch('/api/orders/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          deliveryAddress: orderType === 'pickup' ? 'Pickup at Store' : location,
          orderType: orderType,
          deliveryTime,
          items: cart.map(item => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            unit_price_usd: item.unit_price_usd,
            customizations: item.customizations || []
          })),
          subtotal: subTotal,
          discountAmount: discountVal,
          deliveryFee: effectiveDeliveryFee,
          total: totalVal,
          lat: (orderType === 'delivery' && userCoords) ? userCoords.lat : null,
          lng: (orderType === 'delivery' && userCoords) ? userCoords.lng : null
        })
      });
    } catch (err) {
      console.error('Order save failed (non-blocking):', err);
    }

    const url = getWhatsAppUrl();

    // Redirect to WhatsApp
    window.open(url, '_blank');

    // Clear cart
    cart = [];
    saveCart();
    renderCart();
    toggleCartDrawer(false);
  });

  // Helper function to escape HTML special characters
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Drag-to-scroll support for categories scroller on desktop
  const initDragScroll = () => {
    let isDown = false;
    let startX;
    let scrollLeft;

    categoryScroller.addEventListener('mousedown', (e) => {
      isDown = true;
      categoryScroller.classList.add('dragging');
      startX = e.pageX - categoryScroller.offsetLeft;
      scrollLeft = categoryScroller.scrollLeft;
    });

    categoryScroller.addEventListener('mouseleave', () => {
      isDown = false;
      categoryScroller.classList.remove('dragging');
    });

    categoryScroller.addEventListener('mouseup', () => {
      isDown = false;
      categoryScroller.classList.remove('dragging');
    });

    categoryScroller.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - categoryScroller.offsetLeft;
      const walk = (x - startX) * 1.5; // Scroll speed multiplier
      categoryScroller.scrollLeft = scrollLeft - walk;
    });
  };

  initDragScroll();
  
  // Initial loading order
  loadProducts();
  loadOrderSettings();
  loadUserInfo();
});
