(() => {
  'use strict';
  const KEY = 'fuerte-soporte-demo';
  const $ = id => document.getElementById(id);
  const steps = [...document.querySelectorAll('.claim-step')];
  const fields = {
    name: 'claim-name', docType: 'claim-doc-type', doc: 'claim-doc', phone: 'claim-phone',
    email: 'claim-email', address: 'claim-address', representative: 'claim-representative',
    repDocType: 'claim-rep-doc-type', repDoc: 'claim-rep-doc', kind: 'claim-kind',
    amount: 'claim-amount', item: 'claim-item', detail: 'claim-detail', request: 'claim-request'
  };
  const labels = {
    type: 'Tipo', name: 'Nombres y apellidos', docType: 'Tipo de documento', doc: 'Número de documento',
    phone: 'Teléfono', email: 'Correo electrónico', address: 'Domicilio', representative: 'Padre, madre o representante',
    repDocType: 'Tipo de documento del representante', repDoc: 'Documento del representante',
    kind: 'Producto o servicio', amount: 'Monto en soles', item: 'Descripción del producto o servicio',
    detail: 'Detalle de la reclamación', request: 'Pedido concreto'
  };
  const seeds = [
    { folio: 'FUE-DEMO-001', type: 'Queja', name: 'Persona Demo A', email: 'persona-a@correo.test', detail: 'Ejemplo ficticio de dificultad al encontrar una sección.', request: 'Hacer más visible la navegación.', date: 'Caso precargado' },
    { folio: 'FUE-DEMO-002', type: 'Reclamo', name: 'Persona Demo B', email: 'persona-b@correo.test', detail: 'Ejemplo ficticio de un mensaje poco claro.', request: 'Explicar el mensaje con palabras sencillas.', date: 'Caso precargado' }
  ];
  let step = 0;
  let latest = null;
  function readStore() {
    try { const data = JSON.parse(localStorage.getItem(KEY) || '{}'); return data && !Array.isArray(data) && typeof data === 'object' ? data : {}; }
    catch { return {}; }
  }
  function value(id) { return $(id).value.trim(); }
  function getData() {
    const data = { type: document.querySelector('input[name="claim-type"]:checked')?.value || '', minor: $('claim-minor').checked };
    for (const [key, id] of Object.entries(fields)) data[key] = value(id);
    if (!data.minor) { data.representative = ''; data.repDocType = ''; data.repDoc = ''; }
    return data;
  }
  function error(control, message) {
    control.setAttribute('aria-invalid', 'true');
    const note = $(control.id + '-error');
    if (note) { note.textContent = message; control.setAttribute('aria-describedby', note.id); }
  }
  function clearErrors() {
    document.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
    document.querySelectorAll('.field-error').forEach(node => node.textContent = '');
    $('claim-status').textContent = '';
  }
  function validate(index) {
    clearErrors();
    if (index === 0 && !document.querySelector('input[name="claim-type"]:checked')) {
      $('type-error').textContent = 'Selecciona reclamo o queja.';
      document.querySelector('input[name="claim-type"]').focus(); return false;
    }
    if (index === 3 && !$('claim-demo-check').checked) {
      error($('claim-demo-check'), 'Confirma que los datos son ficticios.'); $('claim-demo-check').focus(); return false;
    }
    if (index !== 1 && index !== 2) return true;
    const ids = index === 1
      ? ['claim-name', 'claim-doc-type', 'claim-doc', 'claim-phone', 'claim-email', 'claim-address', ...($('claim-minor').checked ? ['claim-representative', 'claim-rep-doc-type', 'claim-rep-doc'] : [])]
      : ['claim-kind', 'claim-amount', 'claim-item', 'claim-detail', 'claim-request'];
    let first = null;
    for (const id of ids) {
      const control = $(id);
      let message = '';
      if (!value(id)) message = 'Completa este campo.';
      else if (id === 'claim-doc' || id === 'claim-rep-doc') {
        const docType = value(id === 'claim-doc' ? 'claim-doc-type' : 'claim-rep-doc-type');
        const documentValue = value(id).toUpperCase();
        if (docType === 'DNI' && !/^\d{8}$/.test(documentValue)) message = 'El DNI de ejemplo debe tener 8 dígitos.';
        else if (docType !== 'DNI' && !/^[A-Z0-9]{4,20}$/.test(documentValue)) message = 'Usa entre 4 y 20 letras o números.';
      }
      if (!message && id === 'claim-email' && !control.validity.valid) message = 'Escribe un correo de ejemplo válido.';
      if (!message && id === 'claim-amount' && (!/^\d+(?:\.\d{1,2})?$/.test(value(id)) || !control.validity.valid)) message = 'Ingresa un monto entre 0 y 9 999 999, con hasta dos decimales.';
      if (!message && control.maxLength > -1 && value(id).length > control.maxLength) message = `Máximo ${control.maxLength} caracteres.`;
      if (!message && !control.validity.valid) message = 'Revisa el formato de este campo.';
      if (message) { error(control, message); first ||= control; }
    }
    if (first) { first.focus(); return false; }
    return true;
  }
  function showStep(index) {
    if (!Number.isInteger(index) || index < 0 || index >= steps.length) return;
    step = index;
    steps.forEach((section, i) => section.hidden = i !== step);
    document.querySelectorAll('[data-step-label]').forEach((item, i) => {
      item.classList.toggle('active', i === step);
      item.classList.toggle('done', i < step);
      if (i === step) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    $('claim-back').hidden = step === 0;
    $('claim-next').hidden = step === 3;
    $('claim-submit').hidden = step !== 3;
    clearErrors();
    if (step === 3) renderFields($('review-content'), getData(), false);
    $(steps[step].querySelector('h2').id).focus();
  }
  function row(container, label, content) {
    const wrap = document.createElement('div'); wrap.className = 'data-row';
    const term = document.createElement('dt'); term.textContent = label;
    const desc = document.createElement('dd'); desc.textContent = content || 'No consignado';
    wrap.append(term, desc); container.append(wrap);
  }
  function renderFields(target, data, withMeta) {
    target.replaceChildren();
    const list = document.createElement('dl'); list.className = 'data-list';
    if (withMeta) {
      row(list, 'Folio local de demostración', data.folio);
      row(list, 'Fecha de registro local', data.date);
    }
    row(list, 'Proveedor', 'Fuerte · proyecto académico (datos legales no configurados)');
    for (const key of ['type', 'name', 'docType', 'doc', 'phone', 'email', 'address']) row(list, labels[key], data[key]);
    row(list, 'Consumidor menor de edad', data.minor ? 'Sí' : 'No');
    if (data.minor) for (const key of ['representative', 'repDocType', 'repDoc']) row(list, labels[key], data[key]);
    for (const key of ['kind', 'amount', 'item', 'detail', 'request']) row(list, labels[key], data[key]);
    row(list, 'Acciones u observaciones del proveedor', 'No corresponde: sin recepción ni atención oficial');
    target.append(list);
  }
  function formatText(data) {
    const lines = ['FUERTE · HOJA DE RECLAMACIÓN DE DEMOSTRACIÓN', 'Sin envío ni recepción oficial. Solo datos ficticios.', ''];
    const holder = document.createElement('div'); renderFields(holder, data, true);
    for (const line of holder.querySelectorAll('.data-row')) lines.push(`${line.querySelector('dt').textContent}: ${line.querySelector('dd').textContent}`);
    lines.push('', 'Este folio local no acredita presentación legal ni inicia un plazo de respuesta.');
    return lines.join('\n');
  }
  function track(folio) {
    const target = $('track-result'); target.replaceChildren();
    const stored = readStore().claims;
    const claim = [...(Array.isArray(stored) ? stored : []), ...seeds].find(item => typeof item?.folio === 'string' && item.folio.toUpperCase() === folio.trim().toUpperCase());
    if (!claim) { target.textContent = 'No hay una hoja con ese folio en esta demostración local.'; return; }
    const heading = document.createElement('strong'); heading.textContent = claim.folio;
    const note = document.createElement('p'); note.textContent = seeds.includes(claim) ? 'Caso precargado · sin trámite real' : 'Guardado en este navegador · sin trámite real';
    const card = document.createElement('div'); card.className = 'result-card'; card.append(heading, note);
    renderFields(card, claim, true); target.append(card);
  }
  $('claim-minor').addEventListener('change', () => { $('representative-fields').hidden = !$('claim-minor').checked; clearErrors(); });
  $('claim-back').addEventListener('click', () => showStep(step - 1));
  $('claim-next').addEventListener('click', () => { if (validate(step)) showStep(step + 1); });
  $('claim-form').addEventListener('submit', event => {
    event.preventDefault();
    if (step !== 3) { if (validate(step)) showStep(step + 1); return; }
    if (!validate(3)) return;
    const store = readStore(); const claims = Array.isArray(store.claims) ? store.claims : [];
    const year = new Date().getFullYear();
    const prefix = `FUE-DEMO-${year}-`;
    const previous = claims.reduce((highest, item) => {
      if (typeof item?.folio !== 'string' || !item.folio.startsWith(prefix)) return highest;
      const suffix = item.folio.slice(prefix.length);
      const number = Number(suffix);
      return /^\d+$/.test(suffix) && Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
    }, 0);
    const counter = Math.max(previous, Number.isSafeInteger(store.claimSequence) ? store.claimSequence : 0) + 1;
    const folio = prefix + String(counter).padStart(6, '0');
    const data = { ...getData(), folio, date: new Date().toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' }) };
    store.claims = [data, ...claims];
    store.claimSequence = counter;
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch { $('claim-status').textContent = 'No se pudo guardar en este navegador. Comprueba el almacenamiento disponible.'; return; }
    latest = data; $('claim-form').hidden = true; $('claim-receipt').hidden = false;
    renderFields($('receipt-content'), data, true); $('track-code').value = folio;
    $('receipt-title').focus();
  });
  $('receipt-print').addEventListener('click', () => window.print());
  $('receipt-download').addEventListener('click', () => {
    if (!latest) return;
    const url = URL.createObjectURL(new Blob([formatText(latest)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${latest.folio}.txt`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('receipt-new').addEventListener('click', () => { latest = null; $('claim-form').reset(); $('representative-fields').hidden = true; $('claim-form').hidden = false; $('claim-receipt').hidden = true; showStep(0); });
  $('track-form').addEventListener('submit', event => { event.preventDefault(); track($('track-code').value); });
  document.querySelectorAll('[data-folio]').forEach(button => button.addEventListener('click', () => { $('track-code').value = button.dataset.folio; track(button.dataset.folio); }));
})();
