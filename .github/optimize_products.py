from pathlib import Path
import json
import re
import urllib.request

SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzGGmCePitQSQPoNT4_Wpu6mHkXAjaYI6_F2sRvYy6LbaAPpRg1mpeojO_4hO1vcPCRog/exec?action=getProducts'

# 1) Refresh a same-origin static snapshot for fast first visits.
try:
    req = urllib.request.Request(SHEETS_URL, headers={'User-Agent': 'Mozilla/5.0 ISR-Catalog-Cache/1.0'})
    with urllib.request.urlopen(req, timeout=20) as response:
        data = json.loads(response.read().decode('utf-8'))
    products = data.get('products') if isinstance(data, dict) else None
    if data.get('ok') and isinstance(products, list) and products:
        Path('products-cache.json').write_text(
            json.dumps({'ok': True, 'products': products}, ensure_ascii=False, separators=(',', ':')),
            encoding='utf-8'
        )
        print(f'Cached {len(products)} products')
    else:
        print('WARNING: Apps Script returned no valid products; keeping previous snapshot if present')
except Exception as exc:
    print(f'WARNING: snapshot refresh failed: {exc}')

# 2) Patch index.html so cached/snapshot data paints immediately and Sheets refreshes in background.
path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

marker = "let storeProducts = [];\n"
helpers = r'''

const PRODUCT_CACHE_KEY = 'isr_products_cache_v2';
const PRODUCTS_STATIC_URL = './products-cache.json';
const PRODUCT_FETCH_TIMEOUT_MS = 7000;

function readCachedProducts(){
  try{
    const cached = JSON.parse(localStorage.getItem(PRODUCT_CACHE_KEY) || '[]');
    return Array.isArray(cached) ? normalizeProductsFromSheets(cached) : [];
  }catch(e){
    console.warn('[ISR] No se pudo leer el cache local:', e);
    return [];
  }
}

function saveCachedProducts(products){
  try{
    localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(products));
  }catch(e){
    console.warn('[ISR] No se pudo guardar el cache local:', e);
  }
}

function hydrateProductsFromCache(){
  const cached = readCachedProducts();
  if(!cached.length) return false;
  storeProducts = cached;
  renderAllGrids();
  hideSplash(true);
  return true;
}

async function loadStaticProductSnapshot(){
  try{
    const r = await fetch(PRODUCTS_STATIC_URL, { cache: 'force-cache' });
    if(!r.ok) return false;
    const d = await r.json();
    const products = Array.isArray(d) ? d : d.products;
    if(!Array.isArray(products) || !products.length || storeProducts.length) return false;
    storeProducts = normalizeProductsFromSheets(products);
    saveCachedProducts(storeProducts);
    renderAllGrids();
    hideSplash(true);
    return true;
  }catch(e){
    console.warn('[ISR] Snapshot estatico no disponible:', e);
    return false;
  }
}
'''

if "const PRODUCT_CACHE_KEY = 'isr_products_cache_v2';" not in text:
    if marker not in text:
        raise SystemExit('Could not find storeProducts marker')
    text = text.replace(marker, marker + helpers, 1)

new_loader = r'''async function loadStoreProducts(){
  const hadCachedProducts = hydrateProductsFromCache();
  if(!hadCachedProducts) loadStaticProductSnapshot();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);

  try{
    const r = await fetch(`${SHEETS_URL}?action=getProducts&_=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();

    if(d.ok && Array.isArray(d.products) && d.products.length){
      const freshProducts = normalizeProductsFromSheets(d.products);
      if(!freshProducts.length) throw new Error('Google Sheets devolvio un catalogo vacio');
      storeProducts = freshProducts;
      saveCachedProducts(freshProducts);
      renderAllGrids();
      hideSplash(true);
      return;
    }

    throw new Error(d.error || 'Google Sheets no devolvio productos');
  }catch(e){
    console.error('[ISR] Error al actualizar productos:', e);
    if(!storeProducts.length){
      const cached = readCachedProducts();
      if(cached.length){
        storeProducts = cached;
        renderAllGrids();
      }
    }
    hideSplash(storeProducts.length > 0);
  }finally{
    clearTimeout(timeout);
  }
}

function hideSplash(fast = false){
  const bar = document.getElementById('splash-bar');
  const splash = document.getElementById('splash');
  if(!bar || !splash) return;
  bar.style.width = '100%';
  setTimeout(() => { splash.classList.add('hidden'); }, fast ? 80 : 180);
}
'''

pattern = re.compile(
    r"async function loadStoreProducts\(\)\{.*?\n\}\n\n\nfunction hideSplash\(\).*?\n\}\n",
    re.S
)
if "const PRODUCT_CACHE_KEY = 'isr_products_cache_v2';" in text:
    text, count = pattern.subn(new_loader, text, count=1)
    if count != 1 and 'hideSplash(fast = false)' not in text:
        raise SystemExit(f'Expected one loader block, replaced {count}')

text = text.replace('class="product-image" loading="lazy">', 'class="product-image" loading="lazy" decoding="async">')
text = text.replace('}, 1200);', '}, 900);', 1)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('index.html optimized')
else:
    print('index.html already optimized')
