(function (global) {
  'use strict';
  function isOnOrder(product) {
    return String(product.badge || '').trim().toLowerCase() === 'por encargue';
  }
  global.ISRCatalogAvailability = Object.freeze({ isOnOrder });
})(typeof window !== 'undefined' ? window : globalThis);
