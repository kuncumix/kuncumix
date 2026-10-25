/* ============================================================
   Küncü Mix QR Menü — mantık
   - Kategoriler: tıklayınca o kategori görünür (ortada, kaymalı)
   - Ürüne tıklayınca detay paneli (foto + içerik + gramaj seçeneği)
   - Adet + Sepet (localStorage) → WhatsApp ile sipariş
   - Açık/Kapalı durumu (17:00 - 03:00)
   ============================================================ */
(() => {
  'use strict';

  const CART_KEY = 'kuncumix_cart_v3';
  const NAME_KEY = 'kuncumix_name';
  const ADDR_KEY = 'kuncumix_addr';
  const PAY_KEY  = 'kuncumix_pay';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let MENU = null;
  let cart = loadCart();
  let activeCat = null;
  let detailId = null;
  let detailOpts = new Set();
  let payMethod = 'Nakit / Havale-EFT';

  const money = (n) => `${Number(n).toLocaleString('tr-TR', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })} TL`;

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || {}; }
    catch { return {}; }
  }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 1600);
  }

  /* ---------------- Sepet anahtarları / fiyat ---------------- */
  function parseKey(key) {
    const [id, opts] = String(key).split('|');
    return { id, optIds: opts ? opts.split(',') : [] };
  }
  function itemById(id) {
    for (const cat of MENU.categories) {
      const found = cat.items.find((i) => i.id === id);
      if (found) return found;
    }
    return null;
  }
  function optionsOf(item, optIds) {
    return (item.options || []).filter((o) => optIds.includes(o.id));
  }
  function keyPrice(key) {
    const { id, optIds } = parseKey(key);
    const it = itemById(id);
    if (!it) return 0;
    return it.price + optionsOf(it, optIds).reduce((s, o) => s + o.price, 0);
  }
  function keyName(key) {
    const { id, optIds } = parseKey(key);
    const it = itemById(id);
    if (!it) return '';
    const opts = optionsOf(it, optIds);
    return opts.length ? `${it.name} (${opts.map((o) => o.name).join(', ')})` : it.name;
  }

  const telHref = () => 'tel:+' + (MENU.brand.whatsapp || MENU.brand.phone || '').replace(/\D/g, '').replace(/^0/, '');
  const waHref  = (msg) => `https://wa.me/${MENU.brand.whatsapp}?text=${encodeURIComponent(msg)}`;

  /* ---------------- Marka ---------------- */
  function applyBrand() {
    const b = MENU.brand;
    document.title = `${b.fullName || b.name} · Menü`;
    $('#brandName').textContent = b.fullName || b.name;
    $('#brandSubtitle').textContent = b.subtitle || '';
    $('#footerBrand').textContent = b.fullName || b.name;

    $('#orderLineNum').textContent = b.phone || '—';
    $('#orderLineCall').href = telHref();
    $('#orderLineWa').href = waHref(`Merhaba ${b.name} 👋 Sipariş vermek istiyorum.`);

    $('#heroCall').href = telHref();
    $('#heroCallNum').textContent = b.phone || 'Hemen Ara';
    $('#heroWa').href = waHref(`Merhaba ${b.name} 👋 Sipariş vermek istiyorum.`);
    if (b.instagram) { $('#heroInstagram').hidden = false; $('#heroInstagram').href = b.instagram; }

    if (b.rating) {
      $('#badgeRating').hidden = false;
      $('#ratingVal').textContent = Number(b.rating.value).toFixed(1);
      $('#ratingCount').textContent = b.rating.count;
      const q = encodeURIComponent([b.fullName || b.name, b.address].filter(Boolean).join(' '));
      $('#badgeRating').href = b.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${q}`;
    }
    if (b.delivery) { $('#badgeDelivery').hidden = false; $('#deliveryText').textContent = b.delivery; }

    const h = b.hours || {};
    $('#footerHoursText').textContent = h.note || (h.open && h.close ? `${h.open} – ${h.close}` : '');
    $('#footerAddressText').textContent = b.address || '';
    if (b.address && b.mapsUrl) {
      const link = document.createElement('a');
      link.href = b.mapsUrl; link.target = '_blank'; link.rel = 'noopener';
      link.textContent = '🗺️';
      $('#footerAddressText').after(link);
    }
    if (b.phone) {
      $('#footerPhone').hidden = false;
      $('#footerPhoneLink').href = telHref();
      $('#footerPhoneLink').textContent = b.phone;
    }
    if (b.instagram) { $('#footerInstagram').hidden = false; $('#footerInstagramLink').href = b.instagram; }
    if (b.googleReviewUrl && !b.googleReviewUrl.includes('PLACE_ID_BURAYA')) {
      $('#footerReview').hidden = false;
      $('#googleReviewBtn').href = b.googleReviewUrl;
    }
    $('#footerNotice').textContent = b.notice || '';
  }

  /* ---------------- Açık / Kapalı ---------------- */
  function updateStatus() {
    const { open, close } = MENU.brand.hours || {};
    const badge = $('#badgeStatus');
    if (!open || !close) { badge.hidden = true; return; }
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
    const o = toMin(open), c = toMin(close);
    const isOpen = o <= c ? (cur >= o && cur < c) : (cur >= o || cur < c);
    badge.hidden = false;
    badge.classList.toggle('open', isOpen);
    badge.classList.toggle('closed', !isOpen);
    badge.innerHTML = `${isOpen ? '🟢' : '🔴'} <b>${isOpen ? 'Açık' : 'Kapalı'}</b> · <span id="badgeHours">${open} – ${close}</span>`;
  }

  /* ---------------- Kategoriler ---------------- */
  function renderNav() {
    const nav = $('#catNav');
    nav.innerHTML = '';
    MENU.categories.forEach((cat) => {
      const a = document.createElement('a');
      a.className = 'chip';
      a.href = '#' + cat.id;
      a.dataset.cat = cat.id;
      a.textContent = cat.name;
      a.addEventListener('click', (e) => { e.preventDefault(); selectCategory(cat.id); });
      nav.appendChild(a);
    });
  }

  function selectCategory(id, scroll = true) {
    activeCat = id;
    $$('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === id));
    $$('.cat-section').forEach((s) => { s.hidden = s.id !== id; });
    const chip = $(`.chip[data-cat="${id}"]`);
    chip?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (scroll) $('#menuRoot').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ---------------- Kart aksiyonu (hızlı ekle, baz ürün) ---------------- */
  function actHtml(id) {
    const q = cart[id] || 0;
    if (q <= 0) {
      const it = itemById(id);
      if (it?.options?.length) {
        return `<button class="item__add" type="button" data-open-detail="${id}" aria-label="Seçenekli ekle">+</button>`;
      }
      return `<button class="item__add" type="button" data-add="${id}" aria-label="Ekle">+</button>`;
    }
    return `<div class="stepper">
        <button type="button" data-dec="${id}" aria-label="Azalt">−</button>
        <span class="stepper__val">${q}</span>
        <button type="button" data-add="${id}" aria-label="Arttır">+</button>
      </div>`;
  }
  function refreshItemAction(id) {
    $$(`.item__act[data-act="${id}"]`).forEach((box) => { box.innerHTML = actHtml(id); });
    if (detailId === id && !$('#detailSheet').hidden) updateDetailAct();
  }

  /* ---------------- Menü ---------------- */
  function renderMenu() {
    const root = $('#menuRoot');
    root.innerHTML = '';
    MENU.categories.forEach((cat) => {
      const section = document.createElement('section');
      section.className = 'cat-section';
      section.id = cat.id;
      section.hidden = true;

      const cards = cat.items.map((it) => `
        <article class="card" data-id="${it.id}">
          <div class="thumb">
            ${it.image
              ? `<img loading="lazy" src="${it.image}" alt="${it.name}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🍽️'}))">`
              : '🍽️'}
          </div>
          <div class="info">
            <p class="name">${it.name}</p>
            ${it.desc ? `<p class="desc">${it.desc}</p>` : ''}
            <div class="price-row">
              <span class="price">${money(it.price)}</span>
              ${it.oldPrice ? `<span class="old">${money(it.oldPrice)}</span><span class="disc">İNDİRİM</span>` : ''}
              ${it.options?.length ? `<span class="opt-hint">${it.options.map((o) => `${o.name} ${money(o.price)}`).join(' · ')}</span>` : ''}
            </div>
          </div>
          <div class="item__act" data-act="${it.id}">${actHtml(it.id)}</div>
        </article>`).join('');

      section.innerHTML = `
        <div class="sec-head"><h2>${cat.name}</h2><span class="count">${cat.items.length} ürün</span></div>
        <div class="grid">${cards}</div>`;
      root.appendChild(section);
    });
  }

  /* ---------------- Ürün detayı + opsiyonlar ---------------- */
  function detailKey() {
    if (!detailId) return '';
    return detailOpts.size ? `${detailId}|${[...detailOpts].join(',')}` : detailId;
  }

  function renderDetailOptions() {
    const it = itemById(detailId);
    const box = $('#detailOptions');
    const opts = it?.options || [];
    if (!opts.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = opts.map((o) =>
      `<button type="button" class="opt${detailOpts.has(o.id) ? ' active' : ''}" data-opt="${o.id}">
        ${o.name} <span>+${money(o.price)}</span>
      </button>`).join('');
  }

  function updateDetailPrice() {
    $('#detailPrice').textContent = money(keyPrice(detailKey()));
  }

  function updateDetailAct() {
    const key = detailKey();
    const q = cart[key] || 0;
    if (q <= 0) {
      $('#detailAct').innerHTML = `<button class="btn btn--wa btn--block" type="button" data-add-key="${key}">Sepete Ekle · ${money(keyPrice(key))}</button>`;
    } else {
      $('#detailAct').innerHTML = `<div class="stepper">
        <button type="button" data-dec-key="${key}" aria-label="Azalt">−</button>
        <span class="stepper__val">${q} adet</span>
        <button type="button" data-add-key="${key}" aria-label="Arttır">+</button>
      </div>`;
    }
  }

  function openDetail(id) {
    const it = itemById(id);
    if (!it) return;
    detailId = id;
    detailOpts = new Set();
    $('#detailTitle').textContent = it.name;
    $('#detailImgWrap').innerHTML = it.image
      ? `<img src="${it.image}" alt="${it.name}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🍽️'}))">`
      : '🍽️';
    $('#detailDesc').textContent = it.desc || '';
    const old = $('#detailOld');
    old.hidden = !it.oldPrice;
    if (it.oldPrice) old.textContent = money(it.oldPrice);
    $('#detailDisc').hidden = !it.oldPrice;

    renderDetailOptions();
    updateDetailPrice();
    updateDetailAct();
    $('#detailSheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeDetail() {
    $('#detailSheet').hidden = true;
    if ($('#cartSheet').hidden) document.body.style.overflow = '';
  }

  function toggleOption(optId) {
    if (detailOpts.has(optId)) detailOpts.delete(optId); else detailOpts.add(optId);
    renderDetailOptions();
    updateDetailPrice();
    updateDetailAct();
  }

  /* ---------------- Sepet ---------------- */
  function addToCart(key) {
    cart[key] = (cart[key] || 0) + 1;
    saveCart(); refreshItemAction(parseKey(key).id); updateCartUI();
    toast(`${keyName(key)} · ${cart[key]} adet`);
  }
  function decFromCart(key) {
    const q = (cart[key] || 0) - 1;
    if (q <= 0) delete cart[key]; else cart[key] = q;
    saveCart(); refreshItemAction(parseKey(key).id); updateCartUI();
  }
  function setQty(key, qty) {
    if (qty <= 0) delete cart[key]; else cart[key] = qty;
    saveCart(); refreshItemAction(parseKey(key).id); updateCartUI();
  }

  function cartEntries() {
    return Object.entries(cart)
      .map(([key, qty]) => ({ key, qty, item: itemById(parseKey(key).id) }))
      .filter((e) => e.item);
  }
  function cartTotals() {
    let count = 0, total = 0;
    for (const { key, qty } of cartEntries()) { count += qty; total += keyPrice(key) * qty; }
    return { count, total };
  }

  function updateCartUI() {
    const { count, total } = cartTotals();
    $('#cartBar').hidden = count === 0;
    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = money(total);
    $('#cartGrandTotal').textContent = money(total);

    const list = $('#cartList');
    const entries = cartEntries();
    if (entries.length === 0) {
      list.innerHTML = `<li class="cart-empty">Sepetiniz boş. Menüden ürün ekleyin.</li>`;
    } else {
      list.innerHTML = entries.map(({ key, qty }) => `
        <li class="cart-row">
          <div class="cart-row__info">
            <div class="cart-row__name">${keyName(key)}</div>
            <div class="cart-row__price">${money(keyPrice(key))} × ${qty} = <strong>${money(keyPrice(key) * qty)}</strong></div>
          </div>
          <div class="qty">
            <button type="button" data-dec-key="${key}" aria-label="Azalt">−</button>
            <span>${qty}</span>
            <button type="button" data-add-key="${key}" aria-label="Arttır">+</button>
          </div>
        </li>`).join('');
    }
    buildWhatsAppLink();
  }

  function buildWhatsAppLink() {
    const b = MENU.brand;
    const entries = cartEntries();
    const { total } = cartTotals();
    const name = ($('#custName').value || '').trim();
    const addr = ($('#custAddress').value || '').trim();

    const lines = [`Merhaba ${b.name} 👋`, 'Sipariş vermek istiyorum:'];
    lines.push('');
    entries.forEach(({ key, qty }) => lines.push(`• ${qty} x ${keyName(key)} — ${money(keyPrice(key) * qty)}`));
    lines.push('');
    lines.push(`Toplam: ${money(total)}`);
    if (name || addr) {
      lines.push('');
      lines.push('🛵 Teslimat:');
      if (name) lines.push(`👤 ${name}`);
      if (addr) lines.push(`📍 ${addr}`);
    }
    if (payMethod) {
      if (!(name || addr)) lines.push('');
      lines.push(`💳 Ödeme: ${payMethod}`);
    }

    const btn = $('#orderWaBtn');
    btn.href = waHref(lines.join('\n'));
    btn.style.pointerEvents = entries.length ? 'auto' : 'none';
    btn.style.opacity = entries.length ? '1' : '.5';
  }

  /* ---------------- Teslimat bilgileri ---------------- */
  function restoreOrderInfo() {
    $('#custName').value = localStorage.getItem(NAME_KEY) || '';
    $('#custAddress').value = localStorage.getItem(ADDR_KEY) || '';
    const saved = localStorage.getItem(PAY_KEY);
    setPay(!saved || saved === 'Nakit' ? 'Nakit / Havale-EFT' : saved);
  }
  function setPay(method) {
    payMethod = method || 'Nakit';
    $$('#payOpts .pay__opt').forEach((b) => b.classList.toggle('is-active', b.dataset.pay === payMethod));
    buildWhatsAppLink();
  }

  /* ---------------- Panel aç/kapat ---------------- */
  function openCart() { $('#cartSheet').hidden = false; document.body.style.overflow = 'hidden'; }
  function closeCart() { $('#cartSheet').hidden = true; if ($('#detailSheet').hidden) document.body.style.overflow = ''; }

  /* ---------------- Olaylar ---------------- */
  function bindEvents() {
    // Menü kartları
    $('#menuRoot').addEventListener('click', (e) => {
      const open = e.target.closest('[data-open-detail]');
      if (open) { openDetail(open.dataset.openDetail); return; }
      const add = e.target.closest('[data-add]');
      const dec = e.target.closest('[data-dec]');
      if (add) { addToCart(add.dataset.add); return; }
      if (dec) { decFromCart(dec.dataset.dec); return; }
      const card = e.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });

    // Detay paneli
    $('#detailSheet').addEventListener('click', (e) => {
      if (e.target.closest('[data-close-detail]')) { closeDetail(); return; }
      const opt = e.target.closest('[data-opt]');
      if (opt) { toggleOption(opt.dataset.opt); return; }
      const add = e.target.closest('[data-add-key]');
      const dec = e.target.closest('[data-dec-key]');
      if (add) addToCart(add.dataset.addKey);
      else if (dec) decFromCart(dec.dataset.decKey);
    });

    // Sepet listesi
    $('#cartList').addEventListener('click', (e) => {
      const inc = e.target.closest('[data-add-key]');
      const dec = e.target.closest('[data-dec-key]');
      if (inc) setQty(inc.dataset.addKey, (cart[inc.dataset.addKey] || 0) + 1);
      else if (dec) setQty(dec.dataset.decKey, (cart[dec.dataset.decKey] || 0) - 1);
    });

    $('#cartBar').addEventListener('click', openCart);
    $$('[data-close-cart]').forEach((el) => el.addEventListener('click', closeCart));

    ['#custName', '#custAddress'].forEach((sel) => $(sel).addEventListener('input', buildWhatsAppLink));

    $('#payOpts').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pay]');
      if (b) { setPay(b.dataset.pay); localStorage.setItem(PAY_KEY, b.dataset.pay); }
    });

    $('#orderWaBtn').addEventListener('click', (e) => {
      const addr = ($('#custAddress').value || '').trim();
      localStorage.setItem(NAME_KEY, ($('#custName').value || '').trim());
      localStorage.setItem(ADDR_KEY, addr);
      if (!addr) {
        e.preventDefault();
        toast('Lütfen teslimat adresinizi girin');
        $('#custAddress').focus();
        $('#custAddress').scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    });

    $('#clearCartBtn').addEventListener('click', () => {
      cart = {}; saveCart();
      $$('.item__act').forEach((b) => refreshItemAction(b.dataset.act));
      updateCartUI();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeDetail(); closeCart(); }
    });
  }

  /* ---------------- Başlat ---------------- */
  async function init() {
    try {
      const res = await fetch('menu.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('menu.json okunamadı');
      MENU = await res.json();
    } catch (err) {
      $('#menuRoot').innerHTML = `<p class="cart-empty">Menü yüklenemedi. Lütfen sayfayı yenileyin.</p>`;
      console.error(err);
      return;
    }

    applyBrand();
    updateStatus();
    setInterval(updateStatus, 60000);
    renderNav();
    renderMenu();
    restoreOrderInfo();
    updateCartUI();
    bindEvents();
    selectCategory(MENU.categories[0].id, false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
