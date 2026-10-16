/* Adaptador al catálogo y navegación existentes. Sin escrituras a Supabase. */
(function () {
  'use strict';
  const page = document.getElementById('tradeInPage');
  if (!page || !window.ISRTradeInUI || !window.ISR_TRADEIN_CONFIG) return;
  const view = window.ISRTradeInUI.create(page, {
    config: window.ISR_TRADEIN_CONFIG,
    getProducts: () => typeof storeProducts !== 'undefined' ? storeProducts : [],
    getRate: () => typeof dolarBlue !== 'undefined' ? dolarBlue : null,
    image: product => typeof normalizeProductImageUrl === 'function' ? normalizeProductImageUrl(product.image) : product.image,
    onStore: () => showPage('storePage'),
    onOther: () => window.open('https://wa.me/' + window.ISR_TRADEIN_CONFIG.whatsapp + '?text=' + encodeURIComponent('Hola, quiero consultar la toma de un equipo que no aparece en el cotizador.'), '_blank', 'noopener,noreferrer'),
    scrollTo: element => element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  });
  function open(productId) {
    if (document.getElementById('promoModal') && typeof closePromo === 'function') closePromo();
    view.open(productId == null ? '' : productId);
    showPage('tradeInPage');
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-isr-tradein]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger.dataset.productId || '');
  });
  const originalOpenDetail = window.openDetail;
  if (typeof originalOpenDetail === 'function') {
    window.openDetail = function (id) {
      originalOpenDetail(id);
      const button = document.getElementById('detailTradeInBtn');
      const product = typeof storeProducts !== 'undefined' ? storeProducts.find(item => String(item.id) === String(id)) : null;
      button.hidden = !product || !window.ISRTradeInEngine.eligibleProducts([product]).length;
      button.dataset.productId = String(id);
    };
  }
  const originalRender = window.renderAllGrids;
  if (typeof originalRender === 'function') {
    window.renderAllGrids = function () {
      originalRender();
      if (page.classList.contains('active')) view.refresh();
    };
  }
  window.ISRTradeIn = Object.freeze({ open, refresh: view.refresh });
})();
