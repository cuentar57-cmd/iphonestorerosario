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

# Keep card images lightweight and non-blocking.
text = re.sub(r'(https://drive\.google\.com/thumbnail\?id=[^\"\'\s&]+&sz=)w\d+', r'\1w480', text)
text = text.replace('class="product-image" loading="lazy">', 'class="product-image" loading="lazy" decoding="async">')
text = text.replace('}, 1200);', '}, 900);', 1)

# 3) Add an animated WhatsApp-help prompt beside every Consultar action.
wa_css = r'''

/* ===== CONSULTAR + WHATSAPP HELP ===== */
.consult-with-help{
  display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;width:100%;
}
.wa-help-bubble{
  appearance:none;border:1px solid rgba(37,211,102,.35);background:rgba(37,211,102,.10);
  color:var(--text);border-radius:14px;padding:8px 11px;display:inline-flex;align-items:center;gap:8px;
  font:600 .72rem/1.25 'DM Sans',sans-serif;cursor:pointer;transition:transform .22s ease,background .22s ease,border-color .22s ease,box-shadow .22s ease;
  max-width:185px;text-align:left;position:relative;overflow:hidden;
  animation:waHelpFloat 2.8s ease-in-out infinite;
}
.wa-help-bubble::before{
  content:'';width:8px;height:8px;border-radius:50%;background:#25d366;flex:0 0 auto;
  box-shadow:0 0 0 0 rgba(37,211,102,.45);animation:waHelpPulse 1.7s ease-out infinite;
}
.wa-help-bubble::after{
  content:'';position:absolute;inset:-30% auto -30% -45%;width:32%;transform:skewX(-18deg);
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent);animation:waHelpShine 3.8s ease-in-out infinite;
}
.wa-help-bubble:hover,.wa-help-bubble:focus-visible{
  transform:translateY(-2px) scale(1.02);background:rgba(37,211,102,.16);border-color:rgba(37,211,102,.60);
  box-shadow:0 10px 24px rgba(37,211,102,.14);outline:none;
}
.wa-help-bubble strong{color:#20b858;font-weight:800}
@keyframes waHelpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes waHelpPulse{0%{box-shadow:0 0 0 0 rgba(37,211,102,.45)}70%{box-shadow:0 0 0 8px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}}
@keyframes waHelpShine{0%,62%{left:-45%}82%,100%{left:125%}}
@media(max-width:600px){
  .consult-with-help{gap:6px}
  .wa-help-bubble{font-size:.64rem;padding:7px 8px;max-width:145px;border-radius:12px}
}
@media(prefers-reduced-motion:reduce){
  .wa-help-bubble,.wa-help-bubble::before,.wa-help-bubble::after{animation:none!important}
}
'''
if '/* ===== CONSULTAR + WHATSAPP HELP ===== */' not in text:
    text = text.replace('</style>', wa_css + '\n</style>', 1)

wa_js = r'''
<script id="wa-consult-helper">
(function(){
  function optimizeCatalogImage(img){
    if(!img || img.dataset.fastImageDone === '1') return;
    img.dataset.fastImageDone = '1';
    img.decoding = 'async';
    if(!img.closest('.detail-modal,.modal')) img.loading = 'lazy';
    const src = img.getAttribute('src') || '';
    if(src.includes('drive.google.com/thumbnail')){
      const optimized = src.match(/[?&]sz=w\d+/) ? src.replace(/([?&]sz=)w\d+/, '$1w480') : src + (src.includes('?') ? '&' : '?') + 'sz=w480';
      if(optimized !== src) img.src = optimized;
    }
  }

  function decorateConsultButtons(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button,a').forEach(function(btn){
      if((btn.textContent || '').trim().toLowerCase() !== 'consultar') return;
      if(btn.closest('.consult-with-help')) return;
      const parent = btn.parentNode;
      if(!parent) return;
      const wrap = document.createElement('div');
      wrap.className = 'consult-with-help';
      parent.insertBefore(wrap, btn);
      wrap.appendChild(btn);

      const help = document.createElement('button');
      help.type = 'button';
      help.className = 'wa-help-bubble';
      help.setAttribute('aria-label', 'Tenés alguna duda? Hablános al WhatsApp');
      help.innerHTML = '<span>¿Tenés alguna duda?<br><strong>Hablános al WhatsApp</strong></span>';
      help.addEventListener('click', function(){ btn.click(); });
      wrap.appendChild(help);
    });
  }

  function enhance(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img.product-image,.product-media img').forEach(optimizeCatalogImage);
    decorateConsultButtons(scope);
  }

  enhance(document);
  const observer = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if(node.nodeType !== 1) return;
        if(node.matches && node.matches('img.product-image,.product-media img')) optimizeCatalogImage(node);
        enhance(node);
      });
    });
  });
  observer.observe(document.body,{childList:true,subtree:true});
})();
</script>
'''
if 'id="wa-consult-helper"' not in text:
    text = text.replace('</body>', wa_js + '\n</body>', 1)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('index.html optimized')
else:
    print('index.html already optimized')
