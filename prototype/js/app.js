/* ============================================================
 * Кликабельный прототип «Страхование квартиры» (MYHOUSE-7341)
 * Экран 1 — статичный, открывает боттом-шит.
 * Боттом-шит — 4 ползунка + поле суммы:
 *   перетаскивание трека меняет только правый блок с цифрами;
 *   тап по блоку с цифрами открывает цифровую клавиатуру iPhone.
 * ============================================================ */
(function () {
  'use strict';

  var fmt = new Intl.NumberFormat('ru-RU');

  /* Диапазоны ползунков (₽). Старт = значения из макета. */
  var CONFIG = {
    finish:    { min: 0, max: 7000000, def: 3500000, step: 50000 },
    furniture: { min: 0, max: 8000000, def: 2500000, step: 50000 },
    walls:     { min: 0, max: 2750000, def: 1500000, step: 50000 },
    neighbors: { min: 0, max: 2550000, def: 1100000, step: 50000 }
  };

  /* Базовая сумма недвижимости, которая не меняется ползунками.
   * При стартовых значениях: 3.5 + 2.5 + 1.5 + 2.1 = 9.6 млн */
  var BASE_REALTY = 2100000;

  var TOTAL_DEFAULT = 10700000;
  var PRICE_DEFAULT = 29961;

  var MIN_FILL = 16; /* ширина заливки при 0, как в макете */

  function $(sel) { return document.querySelector(sel); }

  var layer = $('#sheet-layer');
  var scrollEl = $('#sheet-scroll');
  var rows = Array.prototype.slice.call(document.querySelectorAll('.cover-item'));
  var kbLayer = $('#kb-layer');

  var state = {};
  Object.keys(CONFIG).forEach(function (k) { state[k] = CONFIG[k].def; });

  var drag = null;
  var kb = { key: null, raw: '', selected: false };

  function money(v) {
    return fmt.format(v) + ' ₽';
  }

  function phoneScale() {
    var phone = $('#phone');
    return phone ? (phone.getBoundingClientRect().width / phone.clientWidth) : 1;
  }

  function clampVal(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function snapValue(key, v) {
    var cfg = CONFIG[key];
    v = Math.round(v / cfg.step) * cfg.step;
    return clampVal(v, cfg.min, cfg.max);
  }

  /* ---------- Отрисовка одного ползунка ---------- */
  function renderRow(row) {
    var key = row.dataset.slider;
    var cfg = CONFIG[key];
    var v = state[key];
    var track = row.querySelector('.slider-track');
    var trackWidth = track.clientWidth;
    var pct = trackWidth > 0 ? (v - cfg.min) / (cfg.max - cfg.min) : 0;
    pct = clampVal(pct, 0, 1);
    var fillW = Math.round(MIN_FILL + pct * Math.max(0, trackWidth - MIN_FILL));
    var knobLeft = clampVal(fillW - 7, 9, Math.max(9, trackWidth - 7));

    row.querySelector('.slider-fill').style.width = fillW + 'px';
    row.querySelector('.slider-knob').style.left = knobLeft + 'px';
    if (kb.key !== key) {
      row.querySelector('[data-value]').textContent = money(v);
    }
  }

  function renderAll() {
    rows.forEach(renderRow);
  }

  function updateTotals() {
    var realty = BASE_REALTY + state.finish + state.furniture + state.walls;
    var liability = state.neighbors;
    var total = realty + liability;
    var price = Math.round(PRICE_DEFAULT * total / TOTAL_DEFAULT);

    $('[data-total]').textContent = money(total);
    $('[data-realty]').textContent = money(realty);
    $('[data-liability]').textContent = money(liability);
    $('[data-price]').textContent = fmt.format(price) + ' ₽';
  }

  function setValue(key, v, snap) {
    state[key] = snap ? snapValue(key, v) : clampVal(v, CONFIG[key].min, CONFIG[key].max);
    var row = rows.find(function (r) { return r.dataset.slider === key; });
    if (row) renderRow(row);
    updateTotals();
  }

  /* ---------- Клавиатура ---------- */
  function valueEl(key) {
    var row = rows.find(function (r) { return r.dataset.slider === key; });
    return row ? row.querySelector('[data-value]') : null;
  }

  function paintKbValue() {
    var el = valueEl(kb.key);
    if (!el) return;
    var n = kb.raw === '' ? 0 : parseInt(kb.raw, 10);
    if (isNaN(n)) n = 0;
    el.textContent = money(n);
  }

  function applyRawToState() {
    if (!kb.key) return;
    var n = kb.raw === '' ? 0 : parseInt(kb.raw, 10);
    if (isNaN(n)) n = 0;
    /* Пока печатаем — слайдер и итоги по зажатому значению, текст — как введено */
    var clamped = clampVal(n, CONFIG[kb.key].min, CONFIG[kb.key].max);
    state[kb.key] = clamped;
    var row = rows.find(function (r) { return r.dataset.slider === kb.key; });
    if (row) renderRow(row);
    updateTotals();
    paintKbValue();
  }

  function openKeyboard(row) {
    var key = row.dataset.slider;
    if (kb.key && kb.key !== key) closeKeyboard(true);
    kb.key = key;
    kb.raw = String(state[key]);
    kb.selected = true;

    rows.forEach(function (r) {
      var input = r.querySelector('.cover-input');
      input.classList.toggle('editing', r === row);
      input.classList.toggle('selected', r === row);
    });
    paintKbValue();

    kbLayer.classList.add('is-open');
    kbLayer.setAttribute('aria-hidden', 'false');
    scrollEl.style.paddingBottom = '280px';
    requestAnimationFrame(function () {
      row.querySelector('.cover-input').scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function closeKeyboard(commit) {
    if (!kb.key) {
      kbLayer.classList.remove('is-open');
      kbLayer.setAttribute('aria-hidden', 'true');
      scrollEl.style.paddingBottom = '';
      return;
    }
    var key = kb.key;
    if (commit) {
      var n = kb.raw === '' ? 0 : parseInt(kb.raw, 10);
      if (isNaN(n)) n = 0;
      /* С клавиатуры оставляем введённое число, только зажимаем в min/max.
         Шаг 50 000 применяется при перетаскивании ползунка. */
      setValue(key, n, false);
    }
    kb.key = null;
    kb.raw = '';
    kb.selected = false;
    rows.forEach(function (r) {
      var input = r.querySelector('.cover-input');
      input.classList.remove('editing', 'selected');
    });
    kbLayer.classList.remove('is-open');
    kbLayer.setAttribute('aria-hidden', 'true');
    scrollEl.style.paddingBottom = '';
    renderAll();
  }

  function typeDigit(d) {
    if (!kb.key) return;
    if (kb.selected) {
      kb.raw = d === '0' ? '0' : d;
      kb.selected = false;
      var el = valueEl(kb.key);
      if (el) el.classList.remove('selected');
    } else if (kb.raw === '0') {
      kb.raw = d;
    } else if (kb.raw.length < 9) {
      kb.raw += d;
    }
    applyRawToState();
  }

  function typeBackspace() {
    if (!kb.key) return;
    if (kb.selected) {
      kb.raw = '';
      kb.selected = false;
      var el = valueEl(kb.key);
      if (el) el.classList.remove('selected');
    } else {
      kb.raw = kb.raw.slice(0, -1);
    }
    applyRawToState();
  }

  kbLayer.querySelectorAll('.ios-kb-key[data-key]').forEach(function (btn) {
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var k = btn.dataset.key;
      if (k === 'back') typeBackspace();
      else typeDigit(k);
    });
  });
  $('#kb-done').addEventListener('click', function (e) {
    e.preventDefault();
    closeKeyboard(true);
  });
  $('#kb-dismiss').addEventListener('click', function () {
    closeKeyboard(true);
  });

  /* ---------- Перетаскивание трека ---------- */
  function valueFromPoint(track, clientX, key) {
    var cfg = CONFIG[key];
    var rect = track.getBoundingClientRect();
    var scale = phoneScale();
    var x = (clientX - rect.left) / scale;
    var trackWidth = track.clientWidth;
    var pct = trackWidth > 0 ? x / trackWidth : 0;
    pct = clampVal(pct, 0, 1);
    return snapValue(key, cfg.min + pct * (cfg.max - cfg.min));
  }

  function onPointerDown(e) {
    if ($('#sheet').classList.contains('sheet-entering')) return;
    var track = e.currentTarget;
    var row = track.closest('.cover-item');
    var key = row.dataset.slider;
    closeKeyboard(true);
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    drag = { track: track, row: row, key: key };
    track.classList.add('dragging');
    state[key] = valueFromPoint(track, e.clientX, key);
    renderRow(row);
    updateTotals();
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!drag) return;
    state[drag.key] = valueFromPoint(drag.track, e.clientX, drag.key);
    renderRow(drag.row);
    updateTotals();
  }

  function endDrag(e) {
    if (!drag) return;
    var track = drag.track;
    drag = null;
    track.classList.remove('dragging');
    try { track.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
  }

  rows.forEach(function (row) {
    var track = row.querySelector('.slider-track');
    var input = row.querySelector('.cover-input');
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    input.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      openKeyboard(row);
    });
  });

  /* ---------- Открытие/закрытие шита ---------- */
  function openSheet() {
    closeKeyboard(false);
    var sheet = $('#sheet');
    sheet.classList.add('sheet-entering');
    layer.hidden = false;
    void layer.offsetHeight;
    renderAll();
    updateTotals();
    requestAnimationFrame(function () {
      renderAll();
      setTimeout(function () { sheet.classList.remove('sheet-entering'); }, 360);
    });
  }

  function closeSheet() {
    closeKeyboard(true);
    layer.hidden = true;
  }

  $('#btn-open-sheet').addEventListener('click', openSheet);
  $('#sheet-overlay').addEventListener('click', closeSheet);
  $('#btn-apply').addEventListener('click', closeSheet);

  $('#btn-reset').addEventListener('click', function () {
    closeKeyboard(false);
    Object.keys(CONFIG).forEach(function (k) { state[k] = CONFIG[k].def; });
    renderAll();
    updateTotals();
  });

  /* ---------- Экран 1 статичен: никакие другие элементы не активны ---------- */
  document.querySelectorAll('.segment, .doc-link, .pay-action, .btn-primary, .top-text .link-dotted')
    .forEach(function (el) {
      if (el.id === 'btn-apply') return;
      el.addEventListener('click', function (e) { e.preventDefault(); });
    });

  /* ---------- Масштаб телефона под окно ----------
   * Мобильные (сенсорные): телефон занимает 100% вьюпорта, без отступов.
   * Позиционирование детерминированное: phone position:fixed (left/top 50%),
   * transform translate(-50%,-50%) + translateY и scale(cover) — низ телефона
   * привязан к низу видимой области (visualViewport), поэтому шторка внизу
   * никогда не уезжает под адресную строку. Высота шторки ограничивается:
   * min(720px макета, (высота вьюпорта − 40px отступа сверху)/scale) —
   * всегда виден верх затемнённого фона (можно закрыть шторку тапом),
   * кнопки внизу не срезаются, контент между ними скроллится (#sheet-scroll).
   * Десктоп: прежняя рамка с полями 60px и максимальным масштабом 1. */
  function fit() {
    var phone = $('#phone');
    var sheet = $('#sheet');
    var vv = window.visualViewport;
    var vw = vv ? vv.width : window.innerWidth;
    var vh = vv ? vv.height : window.innerHeight;
    var mobile = (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024)
      || window.innerWidth <= 600;
    if (mobile) {
      var scaleCover = Math.max(vw / 375, vh / 812);
      var scaleContain = Math.min(vw / 375, vh / 812);
      var useContain = (vh - 40) < 260 * scaleCover;
      var scale = useContain ? scaleContain : scaleCover;
      phone.style.transform = 'translate(-50%, -50%) translateY(' + ((vh - 812 * scale) / 2).toFixed(2) + 'px) scale(' + scale + ')';
      var sheetH = Math.min(720, (vh - 40) / scale);
      sheet.style.height = sheetH.toFixed(2) + 'px';
      sheet.style.flexBasis = sheetH.toFixed(2) + 'px';
    } else {
      phone.style.transform = 'scale(' + Math.min((window.innerWidth - 60) / 375, (window.innerHeight - 60) / 812, 1) + ')';
      sheet.style.height = '';
      sheet.style.flexBasis = '';
    }
    if (!layer.hidden) renderAll();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  requestAnimationFrame(fit);
})();
