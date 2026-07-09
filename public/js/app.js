document.addEventListener('DOMContentLoaded', () => {
  let products = [];
  let selectedCategory = 'OVRLOAD Meals';
  let searchQuery = '';

  const productList = document.getElementById('product-list');
  const categoryScroller = document.getElementById('category-scroller');
  const searchInput = document.getElementById('search-input');
  const detailOverlay = document.getElementById('detail-overlay');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerPrice = document.getElementById('drawer-price');
  const drawerCategory = document.getElementById('drawer-category');
  const drawerDesc = document.getElementById('drawer-desc');
  const drawerImage = document.getElementById('drawer-image');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  
  // Set copyright year
  document.getElementById('year').textContent = new Date().getFullYear();

  // Load products
  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        products = await res.json();
        
        // Fallback to 'All' if the default category is not found in database products
        const hasDefaultCategory = products.some(p => p.category.toLowerCase() === selectedCategory.toLowerCase());
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
    const uniqueCategories = ['All', ...new Set(products.map(p => p.category))];
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
      const matchesCategory = selectedCategory === 'All' || product.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            product.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    if (filtered.length > 0) {
      productList.innerHTML = filtered.map(product => `
        <article class="product-card glass" data-id="${product.id}">
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" class="card-img" alt="${escapeHtml(product.name)}">` : ''}
          <div class="card-header">
            <h2 class="card-title">${escapeHtml(product.name)}</h2>
            <span class="card-price">$${product.unit_price_usd.toFixed(2)}</span>
          </div>
          <span class="card-category">${escapeHtml(product.category)}</span>
          ${product.description ? `<p class="card-description">${escapeHtml(product.description)}</p>` : ''}
        </article>
      `).join('');

      // Attach detail drawer click events
      productList.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-id');
          const product = products.find(p => p.id === id);
          if (product) openDrawer(product);
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

  // Search logic
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderProducts();
  });

  // Drawer modal management
  function openDrawer(product) {
    drawerTitle.textContent = product.name;
    drawerPrice.textContent = `$${product.unit_price_usd.toFixed(2)}`;
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
    
    detailOverlay.style.display = 'flex';
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
  loadProducts();
});
