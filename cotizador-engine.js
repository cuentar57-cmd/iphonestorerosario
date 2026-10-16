(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ISRTradeInEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const capacityLabel = value => Number(value) >= 1024 ? Number(value) / 1024 + ' TB' : value + ' GB';
  const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
  function identify(product) {
    const name = String(product.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').replace(/iphone\s*(\d)/g, 'iphone $1').replace(/(\d)(pro|plus|mini|max|air)/g, '$1 $2').replace(/promax/g, 'pro max').replace(/\s+/g, ' ').trim();
    const match = name.match(/\biphone\s+(se(?:\s+\d+)?|(?:\d+e?|xr|xs|x)(?:\s+(?:pro(?:\s+max)?|plus|mini|max|air))?)(?=\s|$|[()])/);
    if (!match) return null;
    const model = match[1].trim();
    const storage = String(product.storage || '').trim();
    if (/\d+\s*[\/+]+\s*\d+\s*(?:gb|tb)\b/i.test(storage)) return null;
    const cap = storage.match(/^(\d+(?:[.,]\d+)?)\s*(gb|tb)\b/i);
    if (!cap) return null;
    const capacity = Number(cap[1].replace(',', '.')) * (cap[2].toLowerCase() === 'tb' ? 1024 : 1);
    if (![32, 64, 128, 256, 512, 1024, 2048].includes(capacity)) return null;
    const label = 'iPhone ' + model.split(' ').map(word => ({ pro: 'Pro', max: 'Max', plus: 'Plus', se: 'SE', x: 'X', xs: 'XS', xr: 'XR', air: 'Air' }[word] || word)).join(' ');
    return { model: 'iphone-' + model.replace(/\s+/g, '-'), label, capacity };
  }
  function pricedReferences(products) {
    return (products || []).filter(product => product.active !== false && ['sellado', 'usado'].includes(product.category) && positive(Number(product.priceUsd))).map(product => ({ ...product, priceUsd: Number(product.priceUsd), identity: identify(product) })).filter(product => product.identity);
  }
  function catalogModels(products) {
    const groups = new Map();
    pricedReferences(products).forEach(product => {
      const info = product.identity;
      if (!groups.has(info.model)) groups.set(info.model, { id: info.model, label: info.label, capacities: [] });
      const model = groups.get(info.model);
      if (!model.capacities.includes(info.capacity)) model.capacities.push(info.capacity);
    });
    return [...groups.values()].map(model => ({ ...model, capacities: model.capacities.sort((a, b) => a - b) })).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }
  function referenceFor(answers, products) {
    const candidates = pricedReferences(products).filter(product => product.identity.model === answers.model && product.identity.capacity === Number(answers.capacity));
    const used = candidates.filter(product => product.category === 'usado');
    const references = used.length ? used : candidates;
    return references.sort((a, b) => a.priceUsd - b.priceUsd || String(a.id).localeCompare(String(b.id), 'es'))[0] || null;
  }
  function modelFor(config, id) { return (config.models || []).find(model => model.id === id); }
  function validateDevice(answers, config) {
    const errors = [], model = modelFor(config, answers.model);
    if (!model) errors.push('Elegí el modelo de tu iPhone.');
    if (model && !model.capacities.includes(Number(answers.capacity))) errors.push('Elegí una capacidad válida para ese modelo.');
    return errors;
  }
  function calculate(answers, config, products) {
    const errors = validateDevice(answers, config);
    if (!config.conditions || !config.conditions[answers.condition]) errors.push('Elegí el estado estético.');
    const battery = answers.battery === '' || answers.battery == null ? NaN : Number(answers.battery);
    if (!answers.batteryUnknown && (!Number.isInteger(battery) || battery < 1 || battery > 100)) errors.push('Ingresá un porcentaje entero de batería entre 1 y 100, o marcá que no lo conocés.');
    if (!config.repairs || !config.repairs[answers.repairs]) errors.push('Indicá si se cambiaron piezas.');
    if (!['yes', 'no', 'unknown'].includes(answers.unlocked)) errors.push('Indicá si podés desvincular tu cuenta de iCloud.');
    if (!['yes', 'no'].includes(answers.functional)) errors.push('Indicá si todas las funciones funcionan.');
    if (errors.length) return { status: 'invalid', errors, valueUsd: null, adjustments: [], reasons: [] };
    const reference = referenceFor(answers, products), reasons = [];
    if (answers.unlocked !== 'yes') reasons.push('Necesitamos verificar la desvinculación de iCloud antes de valorar el equipo.');
    if (answers.functional !== 'yes') reasons.push('El equipo tiene una falla de funcionamiento que requiere revisión.');
    if (answers.batteryUnknown) reasons.push('Necesitamos comprobar la salud de la batería.');
    if (config.repairs[answers.repairs].manual) reasons.push('Los cambios de piezas se revisan de forma personalizada.');
    if (!reference) reasons.push('Ya no hay un precio publicado para este modelo y capacidad. Consultanos para cotizarlo.');
    if (!positive(config.discountUsd)) reasons.push('Necesitamos confirmar las condiciones del canje.');
    const valueUsd = reference && positive(config.discountUsd) ? cents(reference.priceUsd - config.discountUsd) : null;
    if (reference && !positive(valueUsd)) reasons.push('El precio publicado de este equipo requiere una cotización personalizada.');
    if (reasons.length) return { status: 'manual', valueUsd: null, reference, adjustments: [], reasons };
    return { status: 'estimated', valueUsd, baseUsd: reference.priceUsd, reference, adjustments: [{ label: 'Diferencia de toma', amountUsd: -config.discountUsd }], reasons: [] };
  }
  function eligibleProducts(products) {
    return pricedReferences(products).filter(product => product.stock === true);
  }
  function difference(result, product) {
    if (!result || result.status !== 'estimated' || !product || !eligibleProducts([product]).length) return null;
    const delta = cents(product.priceUsd - result.valueUsd);
    return { amountUsd: delta, requiresReview: delta < 0 };
  }
  function message(answers, result, product, config, rate) {
    const model = modelFor(config, answers.model);
    const parts = [
      'Hola, quiero consultar un plan canje en iPhone Store Rosario.',
      'Cotización orientativa, sujeta a revisión del equipo.', '', 'ENTREGO',
      (model ? model.label : 'Modelo a confirmar') + ' · ' + capacityLabel(answers.capacity),
      'Estado: ' + ((config.conditions[answers.condition] || {}).label || 'A confirmar'),
      'Batería: ' + (answers.batteryUnknown ? 'A verificar' : answers.battery + '%'),
      'Piezas: ' + ((config.repairs[answers.repairs] || {}).label || 'A confirmar'),
      'Funcionamiento: ' + (answers.functional === 'yes' ? 'Sin fallas declaradas' : 'Requiere revisión'),
      'iCloud: ' + (answers.unlocked === 'yes' ? 'Puedo desvincular mi cuenta' : 'A verificar'),
      'Accesorios: ' + ([answers.box ? 'caja' : '', answers.cable ? 'cable' : ''].filter(Boolean).join(' y ') || 'Solo equipo')
    ];
    if (result.status === 'estimated') {
      parts.push('Valor estimado de toma: USD ' + result.valueUsd);
      parts.push('Referencia publicada: ' + result.reference.name + ' · ' + result.reference.storage + ' · USD ' + result.baseUsd);
      parts.push('Regla de toma: precio publicado menos USD ' + config.discountUsd + '.');
    } else parts.push('Solicito cotización personalizada.', ...(result.reasons || result.errors || []));
    const delta = difference(result, product);
    if (product) parts.push('', 'ME INTERESA', product.name + ' · ' + (product.storage || ''), 'Precio de referencia: USD ' + product.priceUsd);
    if (delta && !delta.requiresReview) {
      parts.push('Diferencia estimada: USD ' + delta.amountUsd);
      if (positive(rate)) parts.push('Diferencia en pesos de referencia: $ ' + Math.round(delta.amountUsd * rate).toLocaleString('es-AR') + ' (tipo de cambio: $ ' + rate.toLocaleString('es-AR') + ' por USD).');
    } else if (delta) parts.push('El valor de toma supera el precio elegido. Necesito confirmar las condiciones de la operación.');
    parts.push('', 'La disponibilidad, el valor de toma y el tipo de cambio se confirman con la tienda.');
    return parts.join('\n');
  }
  return Object.freeze({ identify, catalogModels, referenceFor, calculate, validateDevice, eligibleProducts, difference, message, capacityLabel });
});
