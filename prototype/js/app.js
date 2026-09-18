/* ============================================================
 * Кликабельный прототип «Страхование квартиры» (MYHOUSE-7341)
 * Два телефона рядом:
 *   split — трек + блок суммы + клавиатура;
 *   row   — совмещённая строка 56px, блюр вокруг при зажиме.
 * ============================================================ */
(function () {
  'use strict';

  var fmt = new Intl.NumberFormat('ru-RU');

  /* Диапазоны ползунков (₽). Старт = значения из макета. */
  var CONFIG = {
    finish:    { min: 0, max: 7000000,  def: 3500000, step: 50000 },
    furniture: { min: 0, max: 8000000,  def: 2500000, step: 50000 },
    walls:     { min: 0, max: 2750000,  def: 1500000, step: 50000 },
    neighbors: { min: 0, max: 2550000,  def: 1100000, step: 50000 }
  };

  /* Базовая сумма недвижимости, которая не меняется ползунками.
   * При стартовых значениях: 3.5 + 2.5 + 1.5 + 2.1 = 9.6 млн */
  var BASE_REALTY = 2100000;

  var TOTAL_DEFAULT = 10700000;
  var PRICE_DEFAULT = 29961;

  var MIN_FILL = 16;
  var FILL_OVERLAP = 1; /* заливка накрывает рамку трека, left: -1px (split) */

  function money(v) {
    return fmt.format(v) + ' ₽';
  }

  function mlnParts(v) {
    var mln = v / 1000000;
    var tenths = Math.round(mln * 10) / 10;
    var num = tenths === Math.round(tenths)
      ? String(Math.round(tenths))
      : tenths.toFixed(1).replace('.', ',');
    return { num: num, unit: 'млн ₽' };
  }

  function moneyMln(v) {
    var p = mlnParts(v);
    return p.num + ' ' + p.unit;
  }

  function clampVal(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function snapValue(key, v) {
    var cfg = CONFIG[key];
    v = Math.round(v / cfg.step) * cfg.step;
    return clampVal(v, cfg.min, cfg.max);
  }

  function createApp(root, opts) {
    var isRow = opts.variant === 'row';

    function $(sel) { return root.querySelector(sel); }
    function $all(sel) {
      return Array.prototype.slice.call(root.querySelectorAll(sel));
    }

    var layer = $('.js-sheet-layer');
    var scrollEl = $('.js-sheet-scroll');
    var sheet = $('.js-sheet');
    var rows = $all(isRow ? '.slider-row' : '.cover-item');
    var kbLayer = $('.js-kb-layer');
    var focusEl = $('.js-sheet-focus');

    var state = {};
    Object.keys(CONFIG).forEach(function (k) { state[k] = CONFIG[k].def; });

    var drag = null;
    var kb = { key: null, raw: '', selected: false };

    function setInputRaw(el, raw) {
      var num = raw === '' ? '0' : raw;
      el.innerHTML = '<span class="cover-input-num">' + num + '</span>&nbsp;<span class="cover-input-unit">млн ₽</span>';
    }

    function parseMlnRaw(raw) {
      if (!raw || raw === ',') return 0;
      var n = parseFloat(String(raw).replace(',', '.'));
      if (isNaN(n)) return 0;
      return Math.round(n * 1000000);
    }

    function setInputMoney(el, v) {
      var p = mlnParts(v);
      el.innerHTML = '<span class="cover-input-num">' + p.num + '</span>&nbsp;<span class="cover-input-unit">' + p.unit + '</span>';
    }

    function phoneScale() {
      return root.clientWidth ? (root.getBoundingClientRect().width / root.clientWidth) : 1;
    }

    function layoutFocus() {
      if (!focusEl) return;
      var divider = $('.js-sheet-divider');
      if (!divider) return;
      focusEl.style.top = '0px';
      focusEl.style.bottom = 'auto';
      focusEl.style.height = Math.max(0, divider.offsetTop) + 'px';
    }

    function setFocus(on) {
      if (!focusEl) return;
      if (on) {
        layoutFocus();
        focusEl.classList.add('on');
      } else {
        focusEl.classList.remove('on');
      }
    }

    function renderRow(row) {
      var key = row.dataset.slider;
      var cfg = CONFIG[key];
      var v = state[key];

      if (isRow) {
        var boxW = row.clientWidth;
        var inner = Math.max(0, boxW - 2);
        var pct = inner > 0 ? (v - cfg.min) / (cfg.max - cfg.min) : 0;
        pct = clampVal(pct, 0, 1);
        var fillW = Math.round(MIN_FILL + pct * Math.max(0, inner - MIN_FILL));
        var knobLeft = 1 + 9 + (fillW - MIN_FILL);
        row.querySelector('.slider-fill').style.width = fillW + 'px';
        row.querySelector('.slider-knob').style.left = knobLeft + 'px';
        row.querySelector('[data-value]').textContent = money(v);
        return;
      }

      var track = row.querySelector('.slider-track');
      var boxTrack = track.offsetWidth;
      var pctSplit = boxTrack > 0 ? (v - cfg.min) / (cfg.max - cfg.min) : 0;
      pctSplit = clampVal(pctSplit, 0, 1);
      var maxFill = boxTrack + FILL_OVERLAP;
      var fillSplit = Math.round(MIN_FILL + pctSplit * Math.max(0, maxFill - MIN_FILL));
      var knobSplit = -FILL_OVERLAP + 9 + (fillSplit - MIN_FILL);

      row.querySelector('.slider-fill').style.width = fillSplit + 'px';
      row.querySelector('.slider-knob').style.left = knobSplit + 'px';
      if (kb.key !== key) {
        setInputMoney(row.querySelector('[data-value]'), v);
      }
    }

    function renderAll() {
      rows.forEach(renderRow);
    }

    function formatCover(v) {
      return isRow ? money(v) : moneyMln(v);
    }

    function updateTotals() {
      var realty = BASE_REALTY + state.finish + state.furniture + state.walls;
      var liability = state.neighbors;
      var total = realty + liability;
      var price = Math.round(PRICE_DEFAULT * total / TOTAL_DEFAULT);

      $('[data-total]').textContent = formatCover(total);
      $('[data-realty]').textContent = formatCover(realty);
      $('[data-liability]').textContent = formatCover(liability);
      $('[data-price]').textContent = fmt.format(price) + ' ₽';
    }

    function setValue(key, v, snap) {
      state[key] = snap ? snapValue(key, v) : clampVal(v, CONFIG[key].min, CONFIG[key].max);
      var row = rows.find(function (r) { return r.dataset.slider === key; });
      if (row) renderRow(row);
      updateTotals();
    }

    function valueEl(key) {
      var row = rows.find(function (r) { return r.dataset.slider === key; });
      return row ? row.querySelector('[data-value]') : null;
    }

    function paintKbValue() {
      var el = valueEl(kb.key);
      if (!el) return;
      setInputRaw(el, kb.raw);
    }

    function applyRawToState() {
      if (!kb.key) return;
      var n = parseMlnRaw(kb.raw);
      var clamped = clampVal(n, CONFIG[kb.key].min, CONFIG[kb.key].max);
      state[kb.key] = clamped;
      var row = rows.find(function (r) { return r.dataset.slider === kb.key; });
      if (row) renderRow(row);
      updateTotals();
      paintKbValue();
    }

    function openKeyboard(row) {
      if (!kbLayer) return;
      var key = row.dataset.slider;
      if (kb.key && kb.key !== key) closeKeyboard(true);
      kb.key = key;
      kb.raw = mlnParts(state[key]).num;
      kb.selected = true;

      rows.forEach(function (r) {
        var input = r.querySelector('.cover-input');
        if (!input) return;
        input.classList.toggle('editing', r === row);
        input.classList.toggle('selected', r === row);
      });
      paintKbValue();

      kbLayer.classList.add('is-open');
      kbLayer.setAttribute('aria-hidden', 'false');
      scrollEl.style.paddingBottom = '280px';
      requestAnimationFrame(function () {
        var input = row.querySelector('.cover-input');
        if (input) input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }

    function closeKeyboard(commit) {
      if (!kbLayer) return;
      if (!kb.key) {
        kbLayer.classList.remove('is-open');
        kbLayer.setAttribute('aria-hidden', 'true');
        scrollEl.style.paddingBottom = '';
        return;
      }
      var key = kb.key;
      if (commit) {
        setValue(key, parseMlnRaw(kb.raw), false);
      }
      kb.key = null;
      kb.raw = '';
      kb.selected = false;
      rows.forEach(function (r) {
        var input = r.querySelector('.cover-input');
        if (!input) return;
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
        kb.raw = d;
        kb.selected = false;
        var el = valueEl(kb.key);
        if (el) el.classList.remove('selected');
      } else {
        var parts = kb.raw.split(',');
        if (parts.length === 2) {
          if (parts[1].length >= 1) return;
          kb.raw += d;
        } else if (kb.raw === '0') {
          kb.raw = d;
        } else if (parts[0].length >= 2) {
          return;
        } else {
          kb.raw += d;
        }
      }
      applyRawToState();
    }

    function typeComma() {
      if (!kb.key) return;
      if (kb.selected) {
        kb.raw = '0,';
        kb.selected = false;
        var elSel = valueEl(kb.key);
        if (elSel) elSel.classList.remove('selected');
      } else if (kb.raw.indexOf(',') === -1) {
        kb.raw = (kb.raw === '' ? '0' : kb.raw) + ',';
      } else {
        return;
      }
      applyRawToState();
    }

    function typeBackspace() {
      if (!kb.key) return;
      if (kb.selected) {
        kb.raw = '';
        kb.selected = false;
        var elBs = valueEl(kb.key);
        if (elBs) elBs.classList.remove('selected');
      } else {
        kb.raw = kb.raw.slice(0, -1);
      }
      applyRawToState();
    }

    if (kbLayer) {
      kbLayer.querySelectorAll('.ios-kb-key[data-key]').forEach(function (btn) {
        btn.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var k = btn.dataset.key;
          if (k === 'back') typeBackspace();
          else if (k === 'comma') typeComma();
          else typeDigit(k);
        });
      });
      var kbDone = $('.js-kb-done');
      var kbDismiss = $('.js-kb-dismiss');
      if (kbDone) kbDone.addEventListener('click', function (e) {
        e.preventDefault();
        closeKeyboard(true);
      });
      if (kbDismiss) kbDismiss.addEventListener('click', function () {
        closeKeyboard(true);
      });
    }

    function valueFromPoint(track, clientX, key) {
      var cfg = CONFIG[key];
      var rect = track.getBoundingClientRect();
      var scale = phoneScale();
      var x = (clientX - rect.left) / scale;
      var trackWidth = track.offsetWidth;
      var pct = trackWidth > 0 ? x / trackWidth : 0;
      pct = clampVal(pct, 0, 1);
      return snapValue(key, cfg.min + pct * (cfg.max - cfg.min));
    }

    function onPointerDown(e) {
      if (sheet.classList.contains('sheet-entering')) return;
      var track = e.currentTarget;
      var row = isRow ? track : track.closest('.cover-item');
      var key = row.dataset.slider;
      closeKeyboard(true);
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      drag = { track: track, row: row, key: key };
      track.classList.add('dragging');
      if (isRow) setFocus(true);
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
      if (isRow) setFocus(false);
      try { track.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
    }

    rows.forEach(function (row) {
      var track = isRow ? row : row.querySelector('.slider-track');
      track.addEventListener('pointerdown', onPointerDown);
      track.addEventListener('pointermove', onPointerMove);
      track.addEventListener('pointerup', endDrag);
      track.addEventListener('pointercancel', endDrag);
      if (!isRow) {
        var input = row.querySelector('.cover-input');
        input.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openKeyboard(row);
        });
      }
    });

    function openSheet() {
      closeKeyboard(false);
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
      setFocus(false);
      layer.hidden = true;
    }

    var openBtn = $('.js-open-sheet');
    var overlay = $('.js-sheet-overlay');
    var applyBtn = $('.js-apply');
    var resetBtn = $('.js-reset');
    if (openBtn) openBtn.addEventListener('click', openSheet);
    if (overlay) overlay.addEventListener('click', closeSheet);
    if (applyBtn) applyBtn.addEventListener('click', closeSheet);
    if (resetBtn) resetBtn.addEventListener('click', function () {
      closeKeyboard(false);
      Object.keys(CONFIG).forEach(function (k) { state[k] = CONFIG[k].def; });
      renderAll();
      updateTotals();
    });

    root.querySelectorAll('.segment, .doc-link, .pay-action, .btn-primary, .top-text .link-dotted')
      .forEach(function (el) {
        if (el.classList.contains('js-apply')) return;
        el.addEventListener('click', function (e) { e.preventDefault(); });
      });

    return {
      layer: layer,
      renderAll: renderAll
    };
  }

  var apps = [];
  var phoneA = document.getElementById('phone-a');
  var phoneB = document.getElementById('phone-b');
  if (phoneA && !phoneA.hidden) apps.push(createApp(phoneA, { variant: 'split' }));
  if (phoneB && !phoneB.hidden) apps.push(createApp(phoneB, { variant: 'row' }));

  function visiblePhones() {
    return Array.prototype.filter.call(document.querySelectorAll('.phone'), function (p) {
      return !p.hidden;
    });
  }

  function fit() {
    var phones = visiblePhones();
    var n = phones.length || 1;
    var gap = 40;
    var vv = window.visualViewport;
    var vw = vv ? vv.width : window.innerWidth;
    var vh = vv ? vv.height : window.innerHeight;
    var mobile = (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024)
      || window.innerWidth <= 600;

    if (n === 1 && mobile) {
      var phone = phones[0];
      var sheet = phone.querySelector('.js-sheet');
      var scaleCover = Math.max(vw / 375, vh / 812);
      var scaleContain = Math.min(vw / 375, vh / 812);
      var useContain = (vh - 40) < 260 * scaleCover;
      var scale = useContain ? scaleContain : scaleCover;
      phone.style.transform = 'translate(-50%, -50%) translateY(' + ((vh - 812 * scale) / 2).toFixed(2) + 'px) scale(' + scale + ')';
      if (sheet) {
        var sheetH = Math.min(720, (vh - 40) / scale);
        sheet.style.height = sheetH.toFixed(2) + 'px';
        sheet.style.flexBasis = sheetH.toFixed(2) + 'px';
      }
    } else {
      var deskScale = Math.min(
        (window.innerWidth - 60 - gap * (n - 1)) / (375 * n),
        (window.innerHeight - 60) / 812,
        1
      );
      for (var i = 0; i < phones.length; i++) {
        phones[i].style.transform = 'scale(' + deskScale + ')';
        var sheetEl = phones[i].querySelector('.js-sheet');
        if (sheetEl) {
          sheetEl.style.height = '';
          sheetEl.style.flexBasis = '';
        }
      }
    }
    apps.forEach(function (app) {
      if (app.layer && !app.layer.hidden) app.renderAll();
    });
  }

  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  requestAnimationFrame(fit);
})();
