(function (root) {
  'use strict';
  const E = root.ISRTradeInEngine;
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const usd = value => 'USD ' + Number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const ars = value => '$ ' + Math.round(value).toLocaleString('es-AR');
  function create(host, options) {
    const config = options.config;
    const blank = () => ({ model: '', capacity: '', condition: '', battery: '', batteryUnknown: false, repairs: '', unlocked: '', functional: '', box: false, cable: false });
    const state = { step: 0, answers: blank(), productId: '', category: 'all', search: '', limit: 6, errors: [] };
    let modelOptionsKey = '', capacitiesKey = '', productsMarkup = '', quoteMarkup = '';
    const getRawProducts = () => options.getProducts ? options.getProducts() : [];
    const getProducts = () => E.eligibleProducts(getRawProducts());
    const getProduct = () => getProducts().find(product => String(product.id) === state.productId);
    const getModel = () => config.models.find(model => model.id === state.answers.model);
    const getRate = () => { const rate = options.getRate ? Number(options.getRate()) : 0; return Number.isFinite(rate) && rate > 0 ? rate : null; };
    const result = () => E.calculate(state.answers, config, getRawProducts());
    const image = product => options.image ? options.image(product) : product.image;
    const checked = value => value ? ' checked' : '';
    const modelOptions = () => config.models.map(model => ({ value: model.id, label: model.label }));
    const modelKey = () => JSON.stringify(modelOptions());
    const capacityKey = () => JSON.stringify([state.answers.model, getModel() ? getModel().capacities : []]);
    function selectOptions(choices, value) {
      return '<option value="">Seleccionar</option>' + choices.map(choice => '<option value="' + escape(choice.value) + '"' + (String(value) === String(choice.value) ? ' selected' : '') + '>' + escape(choice.label) + '</option>').join('');
    }
    function select(name, label, choices, value, help) {
      return '<label class="ti-field">' + label + '<select name="' + name + '" aria-label="' + escape(label) + '">' + selectOptions(choices, value) + '</select>' + (help ? '<small>' + help + '</small>' : '') + '</label>';
    }
    function summary() {
      const model = getModel(), a = state.answers, selected = getProduct(), r = state.step === 2 ? result() : null;
      let html = '<aside class="ti-summary" aria-live="polite" aria-atomic="true"><div class="ti-summary-top"><span class="ti-eyebrow">PLAN CANJE</span><h3>Tu cambio, más cerca.</h3><p>Tu iPhone actual puede ser parte del próximo.</p></div><dl class="ti-summary-lines"><div><dt>Tu equipo</dt><dd>' + escape(model ? model.label : 'Todavía sin elegir') + '</dd></div><div><dt>Capacidad</dt><dd>' + (a.capacity ? E.capacityLabel(a.capacity) : '—') + '</dd></div><div><dt>Estado</dt><dd>' + escape(config.conditions[a.condition] ? config.conditions[a.condition].label : '—') + '</dd></div></dl>';
      if (selected) html += '<div class="ti-target-mini"><span class="ti-eyebrow">EL EQUIPO QUE QUERÉS</span><strong>' + escape(selected.name) + '</strong><span>' + escape(selected.storage) + '</span><b>' + usd(selected.priceUsd) + '</b></div>';
      if (state.productId && !selected) html += '<p class="ti-note">El equipo elegido ya no está disponible. Elegí otro del catálogo.</p>';
      if (r && r.status === 'estimated') {
        const delta = E.difference(r, selected);
        html += '<dl class="ti-summary-lines"><div><dt>Tomamos tu usado</dt><dd>' + usd(r.valueUsd) + '</dd></div></dl>';
        if (delta && !delta.requiresReview) html += '<div class="ti-difference"><span>Diferencia estimada a pagar</span><strong>' + usd(delta.amountUsd) + '</strong>' + (getRate() ? '<small>' + ars(delta.amountUsd * getRate()) + ' de referencia</small>' : '') + '</div>';
        if (delta && delta.requiresReview) html += '<p class="ti-note">Tu usado supera el precio de este equipo. Consultanos para confirmar las condiciones del canje.</p>';
      }
      html += '<div class="ti-summary-foot"><span class="ti-check">✓</span><p>El valor final se confirma después de revisar tu equipo.</p></div></aside>';
      return html;
    }
    function deviceStep() {
      const model = getModel();
      return '<div class="ti-card"><span class="ti-eyebrow">PASO 1 DE 3</span><h2>Empecemos por tu iPhone.</h2><p class="ti-intro">Contanos cuál tenés. En unos pasos vas a conocer su valor estimado de canje.</p>' + select('model', 'Modelo de iPhone', config.models.map(model => ({ value: model.id, label: model.label })), state.answers.model) + '<fieldset class="ti-capacities"><legend>Capacidad</legend><div class="ti-chips">' + (model ? model.capacities.map(capacity => '<button type="button" data-ti-action="capacity" data-value="' + capacity + '" aria-pressed="' + (Number(state.answers.capacity) === capacity) + '">' + E.capacityLabel(capacity) + '</button>').join('') : '<span class="ti-field-hint">Elegí un modelo para ver las capacidades.</span>') + '</div></fieldset><p class="ti-field-hint">La encontrás en Ajustes › General › Información.</p><div class="ti-actions"><button class="ti-btn ti-primary" type="button" data-ti-action="next">Continuar <span aria-hidden="true">→</span></button></div><button class="ti-text-btn" type="button" data-ti-action="other">¿No encontrás tu modelo? Consultanos</button></div>';
    }
    function conditionStep() {
      const a = state.answers;
      return '<div class="ti-card"><span class="ti-eyebrow">PASO 2 DE 3</span><h2>Ahora, cómo está.</h2><p class="ti-intro">Mirá tu equipo con buena luz. Elegí la descripción que mejor lo represente.</p><fieldset class="ti-condition"><legend>Estado estético</legend><div class="ti-condition-grid">' + Object.entries(config.conditions).map(([id, condition]) => '<button type="button" data-ti-action="condition" data-value="' + id + '" aria-pressed="' + (a.condition === id) + '"><span class="ti-radio-dot" aria-hidden="true"></span><strong>' + escape(condition.label) + '</strong><span>' + escape(condition.description) + '</span></button>').join('') + '</div></fieldset><div class="ti-form-grid"><label class="ti-field">Salud de la batería<div class="ti-battery-field"><input name="battery" type="number" min="1" max="100" step="1" inputmode="numeric" placeholder="Ej.: 90" value="' + escape(a.battery) + '"' + (a.batteryUnknown ? ' disabled' : '') + '><span>%</span></div><small>Ajustes › Batería › Salud y carga.</small></label>' + select('repairs', '¿Se cambiaron piezas?', Object.entries(config.repairs).map(([value, repair]) => ({ value, label: repair.label })), a.repairs) + '</div><label class="ti-check-field"><input type="checkbox" name="batteryUnknown"' + checked(a.batteryUnknown) + '>No conozco la salud de la batería</label><div class="ti-form-grid">' + select('functional', '¿Funciona todo correctamente?', [{ value: 'yes', label: 'Sí, funciona todo' }, { value: 'no', label: 'Tiene una falla o rotura' }], a.functional, 'Pantalla, Face ID / Touch ID, cámaras, carga y sonido.') + select('unlocked', '¿Podés desvincular tu iCloud?', [{ value: 'yes', label: 'Sí, puedo desvincular mi cuenta' }, { value: 'no', label: 'No puedo desvincularla' }, { value: 'unknown', label: 'Necesito ayuda para verificarlo' }], a.unlocked) + '</div><fieldset class="ti-accessories"><legend>¿Qué entregás con el equipo?</legend><div class="ti-chips"><label class="ti-check-field"><input type="checkbox" name="box"' + checked(a.box) + '>Caja original</label><label class="ti-check-field"><input type="checkbox" name="cable"' + checked(a.cable) + '>Cable</label></div></fieldset><div class="ti-actions"><button class="ti-btn ti-secondary" type="button" data-ti-action="back">← Volver</button><button class="ti-btn ti-primary" type="button" data-ti-action="next">Ver mi cotización →</button></div></div>';
    }
    function filteredProducts() {
      const words = state.search.toLocaleLowerCase('es').trim().split(/\s+/).filter(Boolean);
      return getProducts().filter(product => (state.category === 'all' || product.category === state.category) && words.every(word => (product.name + ' ' + product.storage).toLocaleLowerCase('es').includes(word)));
    }
    function productCards() {
      const products = filteredProducts();
      if (!products.length) return '<p class="ti-empty">No encontramos equipos disponibles con esa búsqueda. Probá con otro modelo.</p>';
      return '<div class="ti-product-grid">' + products.slice(0, state.limit).map(product => '<button type="button" class="ti-product" data-ti-action="product" data-value="' + escape(product.id) + '" aria-pressed="' + (state.productId === String(product.id)) + '"><div class="ti-product-image">' + (image(product) ? '<img src="' + escape(image(product)) + '" alt="' + escape(product.name) + '" loading="lazy">' : '<span class="ti-image-fallback">iPhone</span>') + '</div><div class="ti-product-copy"><span class="ti-product-type">' + (product.category === 'sellado' ? 'SELLADO' : 'USADO') + '</span><strong>' + escape(product.name) + '</strong><span>' + escape(product.storage) + '</span><b>' + usd(product.priceUsd) + '</b></div><span class="ti-product-check" aria-hidden="true">' + (state.productId === String(product.id) ? '✓' : '+') + '</span></button>').join('') + '</div>' + (products.length > state.limit ? '<button class="ti-btn ti-secondary ti-more" type="button" data-ti-action="more">Ver más equipos (' + (products.length - state.limit) + ')</button>' : '');
    }
    function contactUrl(r) {
      const text = E.message(state.answers, r, getProduct(), config, getRate());
      return 'https://wa.me/' + encodeURIComponent(config.whatsapp) + '?text=' + encodeURIComponent(text);
    }
    function contact(r) {
      return '<a class="ti-btn ti-primary ti-contact" target="_blank" rel="noopener noreferrer" href="' + contactUrl(r) + '">Consultar canje por WhatsApp →</a>';
    }
    function quoteDetails(r, rate) {
      let html = '';
      if (r.status === 'estimated') {
        html += '<div class="ti-value-card"><span class="ti-eyebrow">VALOR ESTIMADO DE TU USADO' + '</span><strong class="ti-value">' + usd(r.valueUsd) + '</strong>' + (rate ? '<span class="ti-value-ars">' + ars(r.valueUsd * rate) + ' de referencia</span>' : '') + '<p>Una estimación inicial. La confirmamos al revisar tu equipo.</p></div><details class="ti-breakdown"><summary>Ver cómo se calculó</summary><p class="ti-reference">' + escape(r.reference.name + ' · ' + r.reference.storage + ' · ' + (r.reference.category === 'usado' ? 'Usado' : 'Sellado')) + '</p><dl><div><dt>Precio publicado</dt><dd>' + usd(r.baseUsd) + '</dd></div>' + r.adjustments.map(item => '<div><dt>' + escape(item.label) + '</dt><dd>' + (item.amountUsd > 0 ? '+' : item.amountUsd < 0 ? '−' : '') + usd(Math.abs(item.amountUsd)) + '</dd></div>').join('') + '</dl></details>';
      } else {
        html += '<div class="ti-card ti-manual"><span class="ti-eyebrow">REVISIÓN PERSONALIZADA</span><h2>Lo vemos con vos.</h2><p>Para darte un valor responsable, necesitamos revisar estos puntos:</p><ul>' + (r.reasons || r.errors || []).map(reason => '<li>' + escape(reason) + '</li>').join('') + '</ul></div>';
      }
      return html;
    }
    function resultStep() {
      const r = result(), rate = getRate();
      let html = '<div class="ti-results"><div data-ti-quote>' + quoteDetails(r, rate) + '</div>';
      html += '<div class="ti-card ti-catalog"><span class="ti-eyebrow">TU PRÓXIMO EQUIPO</span><h2>¿Por cuál lo cambiás?</h2><p class="ti-intro">Elegí un iPhone del catálogo para ver la diferencia estimada.</p><div class="ti-catalog-tools"><label class="ti-search"><span class="ti-sr-only">Buscar un equipo para el canje</span><input type="search" name="productSearch" placeholder="Buscar modelo o capacidad" value="' + escape(state.search) + '"></label><div class="ti-tabs" role="group" aria-label="Tipo de equipo">' + [['all', 'Todos'], ['sellado', 'Sellados'], ['usado', 'Usados']].map(([value, label]) => '<button type="button" data-ti-action="category" data-value="' + value + '" aria-pressed="' + (state.category === value) + '">' + label + '</button>').join('') + '</div></div><div data-ti-products>' + productCards() + '</div></div><div class="ti-card ti-finish">' + contact(r) + '<p class="ti-fine-print">' + 'El canje y la disponibilidad se confirman con la tienda.' + '</p>' + (rate ? '<p class="ti-fine-print" data-ti-rate>Conversión de referencia: ' + ars(rate) + ' por USD. Se confirma al operar.</p>' : '<p class="ti-fine-print" data-ti-rate>Tipo de cambio a confirmar con la tienda.</p>') + '</div><div class="ti-actions"><button class="ti-btn ti-secondary" type="button" data-ti-action="back">← Cambiar datos</button><button class="ti-text-btn" type="button" data-ti-action="reset">Cotizar otro equipo</button></div>';
      return html + '</div>';
    }
    function syncModels() {
      const previous = getModel();
      const latest = E.catalogModels(getRawProducts());
      const current = latest.find(model => model.id === state.answers.model);
      if (previous && !current) latest.push(previous);
      else if (current && previous && state.answers.capacity && !current.capacities.includes(Number(state.answers.capacity))) current.capacities.push(Number(state.answers.capacity));
      config.models = latest;
    }
    function render() {
      syncModels();
      const names = ['Tu iPhone', 'Su estado', 'Tu cotización'];
      host.innerHTML = `<div class="ti-shell">
        <div class="ti-topline"><button type="button" class="ti-text-btn" data-ti-action="store">← Volver a la tienda</button></div>
        <header class="ti-heading"><span class="ti-eyebrow">IPHONE STORE ROSARIO · PLAN CANJE</span><h1>Cotizá tu <span>iPhone.</span></h1><p>Entregá el que tenés. Acercate al que querés.</p></header>
        <ol class="ti-steps" aria-label="Pasos del cotizador">${names.map((name,index)=>'<li'+(index===state.step?' aria-current="step"':'')+'><button type="button" data-ti-action="step" data-value="'+index+'"'+(index>state.step?' disabled':'')+'><span>'+(index<state.step?'✓':index+1)+'</span>'+name+'</button></li>').join('')}</ol>
        <div class="ti-layout" data-ti-step="${state.step}"><main class="ti-main">${state.errors.length?'<div class="ti-errors" role="alert">'+state.errors.map(error=>'<p>'+escape(error)+'</p>').join('')+'</div>':''}${state.step===0?deviceStep():state.step===1?conditionStep():resultStep()}</main>${summary()}</div>
      </div>`;
      modelOptionsKey = modelKey(); capacitiesKey = capacityKey();
      productsMarkup = state.step === 2 ? productCards() : '';
      quoteMarkup = state.step === 2 ? quoteDetails(result(), getRate()) : '';
    }
    function clearErrors() {
      state.errors = [];
      const errors = host.querySelector('.ti-errors');
      if (errors) errors.remove();
    }
    function updateSummary() {
      const current = host.querySelector('.ti-summary');
      if (current) current.outerHTML = summary();
    }
    function updateChoices(action, value) {
      host.querySelectorAll('[data-ti-action="' + action + '"]').forEach(button => {
        const selected = button.dataset.value === String(value);
        button.setAttribute('aria-pressed', String(selected));
        if (action === 'product') button.querySelector('.ti-product-check').textContent = selected ? '✓' : '+';
      });
    }
    function updateModelOptions() {
      const field = host.querySelector('[name="model"]'), key = modelKey();
      // El selector nativo conserva su nodo y sus opciones mientras tiene el foco.
      if (!field || key === modelOptionsKey || document.activeElement === field) return;
      field.innerHTML = selectOptions(modelOptions(), state.answers.model);
      modelOptionsKey = key;
    }
    function updateCapacities() {
      const chips = host.querySelector('.ti-capacities .ti-chips'), key = capacityKey();
      if (!chips || key === capacitiesKey) return;
      const model = getModel();
      chips.innerHTML = model ? model.capacities.map(capacity => '<button type="button" data-ti-action="capacity" data-value="' + capacity + '" aria-pressed="' + (Number(state.answers.capacity) === capacity) + '">' + E.capacityLabel(capacity) + '</button>').join('') : '<span class="ti-field-hint">Elegí un modelo para ver las capacidades.</span>';
      capacitiesKey = key;
    }
    function updateProducts() {
      const cards = host.querySelector('[data-ti-products]');
      if (!cards) return;
      const html = productCards();
      if (html !== productsMarkup) { cards.innerHTML = html; productsMarkup = html; }
    }
    function updateResult() {
      if (state.step !== 2) return;
      const r = result(), rate = getRate(), quote = host.querySelector('[data-ti-quote]');
      const html = quoteDetails(r, rate);
      if (quote && html !== quoteMarkup) {
        const wasOpen = !!quote.querySelector('details[open]');
        quote.innerHTML = html; quoteMarkup = html;
        if (wasOpen && quote.querySelector('details')) quote.querySelector('details').setAttribute('open', '');
      }
      const link = host.querySelector('.ti-contact'), rateText = host.querySelector('[data-ti-rate]');
      if (link) link.setAttribute('href', contactUrl(r));
      if (rateText) rateText.textContent = rate ? 'Conversión de referencia: ' + ars(rate) + ' por USD. Se confirma al operar.' : 'Tipo de cambio a confirmar con la tienda.';
    }
    function refresh() {
      syncModels(); updateModelOptions(); updateCapacities();
      updateResult(); updateProducts(); updateSummary();
    }
    function announceStep() {
      const heading = host.querySelector('.ti-heading');
      if (options.scrollTo && heading) options.scrollTo(heading);
    }
    function next() {
      state.errors = state.step === 0 ? E.validateDevice(state.answers, config) : (result().errors || []);
      if (!state.errors.length) state.step = Math.min(2, state.step + 1);
      render(); announceStep();
    }
    host.addEventListener('click', event => {
      const button = event.target.closest('[data-ti-action]');
      if (!button || !host.contains(button) || button.disabled) return;
      const action = button.dataset.tiAction, value = button.dataset.value;
      if (action === 'next') return next();
      if (action === 'capacity' || action === 'condition') {
        state.answers[action] = action === 'capacity' ? Number(value) : value;
        clearErrors(); updateChoices(action, value); updateSummary(); return;
      }
      if (action === 'back') { state.step = Math.max(0, state.step - 1); state.errors = []; }
      if (action === 'step' && Number(value) <= state.step) { state.step = Number(value); state.errors = []; }
      if (action === 'reset') { state.step = 0; state.answers = blank(); state.errors = []; state.productId = ''; state.search = ''; state.category = 'all'; state.limit = 6; }
      if (action === 'product') {
        state.productId = value; updateChoices(action, value); productsMarkup = productCards();
        updateResult(); updateSummary(); return;
      }
      if (action === 'category' || action === 'more') {
        if (action === 'category') { state.category = value; state.limit = 6; updateChoices(action, value); }
        else state.limit += 6;
        updateProducts(); return;
      }
      if (action === 'store') { if (options.onStore) options.onStore(); return; }
      if (action === 'other') { if (options.onOther) options.onOther(); return; }
      render();
      if (['back', 'step', 'reset'].includes(action)) announceStep();
    });
    host.addEventListener('input', event => {
      const field = event.target;
      if (field.name === 'battery') state.answers.battery = field.value;
      if (field.name === 'productSearch') {
        state.search = field.value; state.limit = 6;
        updateProducts();
      }
    });
    host.addEventListener('change', event => {
      const field = event.target, name = field.name;
      if (!(name in state.answers)) return;
      state.answers[name] = field.type === 'checkbox' ? field.checked : field.value;
      // Al cerrar el teclado, el siguiente toque debe llegar al botón elegido.
      if (name === 'battery') return;
      if (name === 'model') state.answers.capacity = '';
      clearErrors();
      if (name === 'model') updateCapacities();
      if (name === 'batteryUnknown') host.querySelector('[name="battery"]').disabled = !!state.answers.batteryUnknown;
      updateSummary();
    });
    host.addEventListener('focusout', updateModelOptions);
    render();
    return {
      open(productId) { if (productId != null) state.productId = String(productId); render(); },
      refresh,
      snapshot() { return { step: state.step, answers: { ...state.answers }, productId: state.productId, result: state.step === 2 ? result() : null }; }
    };
  }
  root.ISRTradeInUI = Object.freeze({ create });
})(typeof globalThis !== 'undefined' ? globalThis : this);
