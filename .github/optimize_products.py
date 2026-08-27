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

# Keep product card images lightweight and non-blocking.
# Card thumbnails do not need 1000px sources; 480px is enough for the rendered card size.
text = re.sub(r'(https://drive\.google\.com/thumbnail\?id=[^\"\'\s&]+&sz=)w\d+', r'\1w480', text)
text = text.replace('class="product-image" loading="lazy">', 'class="product-image" loading="lazy" decoding="async">')
text = text.replace('}, 1200);', '}, 900);', 1)

# 3) Add a polished animated message beside the fixed green WhatsApp button.
wa_css = r'''

/* ===== WHATSAPP FLOATING HELP ===== */
.wa-help-bubble{
  position:fixed;right:98px;bottom:32px;z-index:998;
  display:flex;align-items:center;gap:9px;
  max-width:245px;padding:11px 14px;border-radius:16px;
  background:var(--card);color:var(--text);text-decoration:none;
  border:1px solid rgba(37,211,102,.34);
  box-shadow:0 10px 28px rgba(0,0,0,.18),0 0 0 1px rgba(37,211,102,.05);
  font:600 .78rem/1.3 'DM Sans',sans-serif;
  transform-origin:right center;
  animation:waHelpEnter .55s cubic-bezier(.2,.8,.2,1) both,waHelpFloat 3s ease-in-out .6s infinite;
  transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease,background .22s ease;
  overflow:hidden;
}
.wa-help-bubble::before{
  content:'';width:9px;height:9px;border-radius:50%;background:#25d366;flex:0 0 auto;
  box-shadow:0 0 0 0 rgba(37,211,102,.48);animation:waHelpPulse 1.8s ease-out infinite;
}
.wa-help-bubble::after{
  content:'';position:absolute;top:-40%;bottom:-40%;left:-35%;width:28%;
  transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.38),transparent);
  animation:waHelpShine 4.2s ease-in-out 1s infinite;
}
.wa-help-bubble strong{display:block;color:#20b858;font-weight:800}
.wa-help-bubble:hover,.wa-help-bubble:focus-visible{
  transform:translateY(-3px) scale(1.02);border-color:rgba(37,211,102,.62);
  box-shadow:0 14px 32px rgba(0,0,0,.20),0 0 22px rgba(37,211,102,.15);outline:none;
}
@keyframes waHelpEnter{from{opacity:0;transform:translateX(18px) scale(.96)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes waHelpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes waHelpPulse{0%{box-shadow:0 0 0 0 rgba(37,211,102,.48)}70%{box-shadow:0 0 0 9px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}}
@keyframes waHelpShine{0%,65%{left:-35%}85%,100%{left:125%}}
@media(max-width:600px){
  .wa-float{right:18px;bottom:20px}
  .wa-help-bubble{right:84px;bottom:24px;max-width:185px;padding:9px 11px;border-radius:14px;font-size:.68rem}
}
@media(max-width:390px){
  .wa-help-bubble{max-width:155px;font-size:.64rem;padding:8px 9px}
}
@media(prefers-reduced-motion:reduce){
  .wa-help-bubble,.wa-help-bubble::before,.wa-help-bubble::after{animation:none!important}
}
'''
if '/* ===== WHATSAPP FLOATING HELP ===== */' not in text:
    text = text.replace('</style>', wa_css + '\n</style>', 1)

wa_js = r'''
<script id="wa-floating-helper">
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

  function addWhatsAppMessage(){
    const wa = document.querySelector('.wa-float');
    if(!wa || document.querySelector('.wa-help-bubble')) return;
    const help = document.createElement('a');
    help.className = 'wa-help-bubble';
    help.href = wa.href;
    help.target = wa.target || '_blank';
    help.rel = 'noopener';
    help.setAttribute('aria-label', 'Tenés alguna duda? Hablános al WhatsApp');
    help.innerHTML = '<span>¿Tenés alguna duda?<strong>Hablános al WhatsApp</strong></span>';
    document.body.appendChild(help);
  }

  function enhance(root){
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img.product-image,.product-media img').forEach(optimizeCatalogImage);
    addWhatsAppMessage();
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
if 'id="wa-floating-helper"' not in text:
    text = text.replace('</body>', wa_js + '\n</body>', 1)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('index.html optimized')
else:
    print('index.html already optimized')
