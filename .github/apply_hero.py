from pathlib import Path
import re

path = Path('index.html')
text = path.read_text(encoding='utf-8')

if 'hero-redesign.css?v=20260830' not in text:
    text = text.replace('</head>', '<link rel="stylesheet" href="hero-redesign.css?v=20260830">\n</head>', 1)

hero_html = '''<section class="hero hero-redesign">
  <div class="hero-content">
    <div class="hero-tag anim-fade-in"><span class="dot"></span>Tienda Oficial Rosario</div>
    <h1 class="anim-fade-up delay-1"><span class="vio">iPhone</span><br>Seminuevos &<br>Sellados</h1>
    <p class="anim-fade-up delay-2">La mejor opción para tu cambio. Todos los equipos con garantía, financiación y envío a todo el país.</p>
    <div class="hero-btns anim-fade-up delay-3">
      <a href="#sellados" class="btn-primary">Ver Productos</a>
      <a href="https://wa.me/5493412521678" target="_blank" class="btn-ghost">Consultar por WhatsApp</a>
    </div>
  </div>

  <div class="hero-visual">
    <div class="hero-orbit o1" aria-hidden="true"></div><div class="hero-orbit o2" aria-hidden="true"></div><div class="hero-orbit o3" aria-hidden="true"></div>
    <div class="hero-phone-glow" aria-hidden="true"></div><div class="hero-pedestal" aria-hidden="true"></div>
    <div class="hero-phone-back" aria-hidden="true"><div class="hero-camera-bump"><span class="hero-lens l1"></span><span class="hero-lens l2"></span><span class="hero-lens l3"></span><span class="hero-camera-flash"></span></div></div>
    <img id="heroPhoneImage" class="hero-phone-image" src="https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-ultramarine-select-202409?wid=940&hei=1112&fmt=png-alpha" alt="iPhone destacado" loading="eager" decoding="async" fetchpriority="high">

    <div class="hero-benefit warranty"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9.2 12 1.8 1.8 3.8-4"/></svg><span>Garantía<strong>Oficial</strong></span></div>
    <div class="hero-benefit shipping"><svg viewBox="0 0 24 24"><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg><span>Envíos a<strong>todo el país</strong></span></div>
    <div class="hero-benefit payment"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg><span>Hasta<strong>12 cuotas</strong></span></div>
    <div class="hero-arrival"><span class="hero-arrival-dot"></span><div><small>NUEVO INGRESO</small><strong id="heroNewest">Cargando...</strong></div></div>
  </div>

  <div class="hero-trust" aria-label="Beneficios de compra">
    <div class="hero-trust-item"><span class="hero-trust-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="m8 13-2 8 6-3 6 3-2-8"/></svg></span><span class="hero-trust-copy">Productos<strong>100% Originales</strong></span></div>
    <div class="hero-trust-item"><span class="hero-trust-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg></span><span class="hero-trust-copy">Revisados por<strong>Expertos</strong></span></div>
    <div class="hero-trust-item"><span class="hero-trust-icon"><svg viewBox="0 0 24 24"><rect x="6" y="9" width="12" height="11" rx="2"/><path d="M9 9V6a3 3 0 0 1 6 0v3M12 13v3"/></svg></span><span class="hero-trust-copy">Compra 100%<strong>Segura</strong></span></div>
    <div class="hero-trust-item"><span class="hero-trust-icon"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg></span><span class="hero-trust-copy">+1000 Clientes<strong>Satisfechos</strong></span></div>
  </div>
  <div class="hero-wa-guide" aria-hidden="true"><svg viewBox="0 0 150 130"><path d="M10 12c35 9 51 31 55 60 3 21 17 29 44 28"/><path d="m99 90 12 10-12 10"/><path d="M120 61l5-12M132 67l10-7M137 80h12"/></svg></div>
</section>'''

if '<section class="hero hero-redesign">' not in text:
    text, n = re.subn(r'<section class="hero">.*?</section>', hero_html, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f'Hero section replacement failed: {n}')

old = """  const newest = sellados[0] || usados[0] || storeProducts[0];
  if(newest) document.getElementById('heroNewest').textContent = newest.name + ' ' + (newest.storage||'');"""
new = """  const newest = sellados[0] || usados[0] || storeProducts[0];
  const heroNewestEl = document.getElementById('heroNewest');
  if(newest && heroNewestEl) heroNewestEl.textContent = newest.name + ' ' + (newest.storage||'');

  const heroImageEl = document.getElementById('heroPhoneImage');
  const showcaseProducts = sortIphoneProducts([...sellados, ...usados].filter(p => p.image));
  const showcaseProduct = showcaseProducts[showcaseProducts.length - 1] || newest;
  if(heroImageEl && showcaseProduct && showcaseProduct.image){
    heroImageEl.src = normalizeProductImageUrl(showcaseProduct.image);
    heroImageEl.alt = (showcaseProduct.name || 'iPhone') + ' destacado';
  }"""
if old in text:
    text = text.replace(old, new, 1)
elif 'const heroNewestEl' not in text:
    raise SystemExit('heroNewest JS block not found')

path.write_text(text, encoding='utf-8')
print('Hero redesign applied to index.html')
