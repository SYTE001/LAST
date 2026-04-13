/* ═══════════════════════════════════════
   NOVAA PUBLIC — script.js
   Fetch live data dari Google Apps Script
   Alur: Ketik kode → langsung tampil produk
═══════════════════════════════════════ */

const API_URL = 'https://script.google.com/macros/s/AKfycbwCUlWJJMOXG3nUsYRwUQIFqc-eOkGMGFZBtAjTQkyv2tcP6cnMAg2BytBlj3aCAbBG/exec';

const TAG_LABELS = {
  mall: '🏬 Mall', diskon: '🔥 Diskon', best: '⭐ Best Seller',
  baru: '✨ Baru', terlaris: '📦 Terlaris', flash: '⚡ Flash Sale', free: '🚚 Free Ongkir'
};

/* ── STATE ── */
let FOLDERS = [];
let PRODUCTS = [];
let dataReady = false;
let dataLoading = true;
let dataError = '';
let activeFolder = null;
let page = 0;
const PAGE = 20;
let loading = false;
let done = false;

/* ── ELEMENTS ── */
const $ = id => document.getElementById(id);
const searchEl = $('searchInput');
const clearBtn = $('clearBtn');
const homeView = $('homeView');
const stateView = $('stateView');
const folderHeader = $('folderHeader');
const fhEmoji = $('fhEmoji');
const fhCode = $('fhCode');
const fhName = $('fhName');
const notFoundView = $('notFoundView');
const notFoundCode = $('notFoundCode');
const productCountBar = $('productCountBar');
const productCountLbl = $('productCountLabel');
const resultView = $('resultView');
const productGrid = $('productGrid');
const spinner = $('spinner');

/* ── INIT: Fetch API ── */
async function initData() {
  dataLoading = true;
  dataError = '';
  try {
    const url = `${API_URL}?action=get`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    
    let raw;
    try {
      raw = await res.json();
    } catch (err) {
      throw new Error('Data format tidak valid');
    }
    
    const data = raw && typeof raw === 'object' ? raw : {};
    if (!data.ok) throw new Error(data.error || 'Server error');
    
    FOLDERS = Array.isArray(data.folders) ? data.folders : [];
    PRODUCTS = Array.isArray(data.products) ? data.products : [];
    dataReady = true;
  } catch (e) {
    console.error('API Error:', e);
    dataReady = false;
    dataError = 'Gagal load data';
  } finally {
    dataLoading = false;
    // Replay pending search if user typed before data was ready
    const pending = searchEl.value.trim();
    if (pending) searchEl.dispatchEvent(new Event('input'));
  }
}

/* ── VIEWS ── */
function showSkeleton() {
  homeView.style.display = 'none';
  stateView.style.display = 'block';
  folderHeader.style.display = 'none';
  notFoundView.style.display = 'none';
  productCountBar.style.display = 'none';
  resultView.style.display = 'block';
  
  productGrid.innerHTML = Array(4).fill(0).map(() => `
    <article class="card skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-body">
         <div class="skeleton-line" style="width: 80%;"></div>
         <div class="skeleton-line" style="width: 50%;"></div>
         <div class="skeleton-line" style="width: 35%; margin-top: 4px;"></div>
         <div class="skeleton-btn"></div>
      </div>
    </article>
  `).join('');
}

function showHome() {
  homeView.style.display = 'flex';
  stateView.style.display = 'none';
  resultView.style.display = 'none';
  clearBtn.style.display = 'none';
  activeFolder = null;
}

function showNotFound(q) {
  homeView.style.display = 'none';
  stateView.style.display = 'block';
  folderHeader.style.display = 'none';
  productCountBar.style.display = 'none';
  notFoundView.style.display = 'block';
  notFoundCode.textContent = q;
  resultView.style.display = 'none';
  productGrid.innerHTML = '';
}

function showError(msg = 'Gagal load data') {
  homeView.style.display = 'none';
  stateView.style.display = 'block';
  folderHeader.style.display = 'none';
  productCountBar.style.display = 'none';
  resultView.style.display = 'block';
  notFoundView.style.display = 'none';
  productGrid.innerHTML = `<div class="empty-msg">${msg}</div>`;
}

function showFolder(folder) {
  activeFolder = folder;
  page = 0; done = false;
  productGrid.innerHTML = '';

  // Update header
  fhEmoji.textContent = folder.emoji || '📁';
  fhCode.textContent = folder.code;
  fhName.textContent = folder.name || '';
  // Hide name element if empty
  fhName.style.display = folder.name ? 'block' : 'none';

  const products = PRODUCTS.filter(p => p.folder_id === folder.folder_id);
  productCountLbl.textContent = `${products.length} produk`;

  homeView.style.display = 'none';
  stateView.style.display = 'block';
  folderHeader.style.display = 'block';
  notFoundView.style.display = 'none';
  productCountBar.style.display = 'block';
  resultView.style.display = 'block';

  loadPage();
}

/* ── SEARCH ── */
let debounce;

searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim();
  clearBtn.style.display = q ? 'block' : 'none';
  clearTimeout(debounce);

  if (!q) { showHome(); return; }

  if (dataLoading) {
    showSkeleton();
    return;
  }

  if (dataError || !dataReady) {
    showError(dataError || 'Gagal load data');
    return;
  }

  showSkeleton();

  debounce = setTimeout(() => {
    try {
      // Search by exact code first, then partial match
      // folder.code bisa number atau string dari API, normalisasi ke string
      const hits = FOLDERS.filter(f => {
        if (!f || typeof f !== 'object') return false;
        const code = String(f.code || '');
        const name = (f.name != null) ? String(f.name).toLowerCase() : '';
        return code === q || code.startsWith(q) || name.includes(q.toLowerCase());
      });

      if (!hits.length) {
        showNotFound(q);
      } else if (hits.length === 1) {
        showFolder(hits[0]);
      } else {
        const exact = hits.find(f => String(f.code) === q);
        showFolder(exact || hits[0]);
      }
    } catch (err) {
      console.error('Search error:', err);
      showError('Gagal mencari produk');
    }
  }, 350);
});

clearBtn.addEventListener('click', () => {
  searchEl.value = '';
  clearBtn.style.display = 'none';
  searchEl.focus();
  showHome();
});

/* ── INFINITE SCROLL ── */
function fmtPrice(n) {
  return String(n || '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function loadPage() {
  if (loading || done || !activeFolder) return;
  loading = true;
  spinner.style.display = 'flex';
  try {
    const all = Array.isArray(PRODUCTS)
      ? PRODUCTS.filter(p => p && p.folder_id === activeFolder.folder_id)
      : [];
    const start = page * PAGE;
    const chunk = all.slice(start, start + PAGE);

    if (!chunk.length) {
      done = true;
      if (page === 0) {
        productGrid.innerHTML = '<div class="empty-msg">Tidak ada produk</div>';
      }
      return;
    }

    chunk.forEach((p, i) => {
      const el = buildCard(p);
      productGrid.appendChild(el);
      setTimeout(() => el.classList.add('v'), i * 35);
    });

    observeImages();
    page++;
    if (start + PAGE >= all.length) done = true;
  } catch (e) {
    console.error('Load page error:', e);
    done = true;
    if (page === 0) {
      productGrid.innerHTML = '<div class="empty-msg">Gagal load data</div>';
    }
  } finally {
    spinner.style.display = 'none';
    loading = false;
  }
}

function getOptimizedImageUrl(url) {
  if (!url) return '';
  if (url.includes('format=webp')) return url;
  const hasQuery = url.includes('?');
  const withFormat = `${url}${hasQuery ? '&' : '?'}format=webp`;
  return /\.(jpe?g|png)(\?.*)?$/i.test(url) ? url.replace(/\.(jpe?g|png)(\?.*)?$/i, '.webp$2') : withFormat;
}

function buildCard(p) {
  const el = document.createElement('article');
  el.className = 'card fi';
  const tagList = p.tags ? String(p.tags).split(',').filter(Boolean) : [];
  const optimizedImageUrl = getOptimizedImageUrl(p.image_url);
  el.innerHTML = `
    <div class="card-img">
      ${p.image_url ? `<img data-src="${optimizedImageUrl}" data-fallback-src="${p.image_url}" alt="${p.product_name}" loading="lazy" decoding="async">` : ''}
    </div>
    <div class="tag-row">${tagList.map(t => `<span class="tag ${t.trim()}">${TAG_LABELS[t.trim()] || t}</span>`).join('')}</div>
    <div class="card-body">
      <div class="card-name">${p.product_name}</div>
      <div class="card-price">Rp ${fmtPrice(p.price)}${p.old_price ? `<span class="card-price-old">Rp ${fmtPrice(p.old_price)}</span>` : ''}</div>
      <button class="card-btn">Beli Sekarang →</button>
    </div>`;
  el.querySelector('.card-btn').addEventListener('click', ev => {
    ev.stopPropagation();
    if (p.affiliate_link) window.open(p.affiliate_link, '_blank');
  });
  return el;
}

let imgObs;
function observeImages() {
  if (!imgObs) {
    imgObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.onerror = () => {
            if (!img.dataset.fallbackSrc || img.src === img.dataset.fallbackSrc) return;
            img.src = img.dataset.fallbackSrc;
          };
          img.onload = () => img.classList.add('show');
          imgObs.unobserve(img);
        }
      });
    }, { rootMargin: '160px' });
  }
  document.querySelectorAll('img[data-src]').forEach(img => imgObs.observe(img));
}

new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) loadPage();
}, { rootMargin: '200px' }).observe($('sentinel'));

/* ── START ── */
initData();
showHome();
