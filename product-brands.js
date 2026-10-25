(function (global) {
  'use strict';

  function detectBrand(product) {
    const explicit = String(product.brand || product.marca || '').trim().toLowerCase();
    if (/^(samsung|galaxy)$/.test(explicit)) return 'samsung';
    if (/^(xiaomi|redmi|poco)$/.test(explicit)) return 'xiaomi';
    if (/^(apple|iphone)$/.test(explicit)) return 'apple';
    if (explicit) return explicit;

    const name = String(product.name || product.nombre || product.Nombre || '').trim();
    if (/\b(samsung|galaxy)\b/i.test(name)) return 'samsung';
    if (/\b(xiaomi|redmi|poco)\b/i.test(name)) return 'xiaomi';
    if (/\b(iphone|ipad|macbook|imac|airpods|apple)\b/i.test(name)) return 'apple';

    const category = String(product.category || product.categoria || '').trim().toLowerCase();
    if (category === 'samsung') return 'samsung';
    if (/^(xiaomi|redmi|poco)$/.test(category)) return 'xiaomi';
    return '';
  }

  function isAndroidPhone(product) {
    const brand = detectBrand(product);
    const category = String(product.category || product.categoria || '').trim().toLowerCase();
    return (brand === 'samsung' || brand === 'xiaomi') &&
      /^(sellado|sellados|usado|usados|samsung|xiaomi|redmi|poco|android|celular|smartphone|telefono)$/.test(category);
  }

  global.ISRCatalogBrands = Object.freeze({ detectBrand, isAndroidPhone });
})(typeof window !== 'undefined' ? window : globalThis);
