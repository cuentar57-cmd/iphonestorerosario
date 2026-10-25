(function (global) {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/iphone\s*(?=\d)/g, 'iphone ')
      .replace(/(\d)([a-z])/g, '$1 $2').replace(/pro\s*max\b/g, 'pro max').replace(/\+/g, ' plus ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function matches(product, query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return !String(query || '').trim();
    const categories = {
      sellado: 'sellado sellados nuevo nuevos',
      usado: 'usado usados seminuevo seminuevos',
      gaming: 'gaming consola consolas',
      tablet: 'tablet tablets ipad ipads',
      mac: 'mac macbook imac',
      accesorio: 'accesorio accesorios'
    };
    const text = normalize([
      product.name, product.model, product.storage, product.color,
      global.ISRCatalogBrands.detectBrand(product), categories[product.category] || product.category
    ].join(' '));
    return terms.every(term => text.includes(term));
  }

  global.ISRCatalogSearch = Object.freeze({ matches });
})(typeof window !== 'undefined' ? window : globalThis);
