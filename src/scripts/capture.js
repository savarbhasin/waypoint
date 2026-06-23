(function() {
  if (window.__recorderAttached) return;
  window.__recorderAttached = true;

  // ── Stop button ───────────────────────────────────────────────────────────
  function injectStopButton() {
    if (document.getElementById('__bap_stop')) return;
    const btn = document.createElement('button');
    btn.id = '__bap_stop';
    btn.innerText = '⏹ Stop Recording';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
      background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '8px',
      padding: '10px 18px', fontSize: '14px', fontWeight: '600',
      cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.35)',
      fontFamily: 'system-ui, sans-serif',
    });
    btn.onclick = function(e) {
      e.stopPropagation(); e.preventDefault();
      btn.innerText = 'Saving…'; btn.disabled = true;
      window.__stopRecording();
    };
    document.body.appendChild(btn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStopButton);
  } else {
    injectStopButton();
  }

  // ── Locator scoring ───────────────────────────────────────────────────────
  const DYNAMIC_PREFIX_RE = /^(?::r[0-9a-z]*:?$|react-|ember\d|radix-|headlessui-|jss\d|sc-|css-[a-z0-9]+$|emotion-)/i;
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  function looksStatic(value) {
    if (!value) return false;
    const v = value.trim();
    if (UUID_RE.test(v) || DYNAMIC_PREFIX_RE.test(v)) return false;
    if (/\d{4,}/.test(v)) return false;
    for (const seg of v.split(/[\s_\-]+/)) {
      if (seg.length < 5) continue;
      const digits = (seg.match(/\d/g) || []).length;
      const hasAlpha = /[a-zA-Z]/.test(seg);
      const vowels = (seg.match(/[aeiouAEIOU]/g) || []).length;
      if (hasAlpha && digits >= 2) return false;
      if (hasAlpha && vowels === 0 && seg.length >= 6) return false;
    }
    return true;
  }

  function q(val, max) {
    let s = val.replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    if (max && s.length > max) s = s.slice(0, max - 3) + '...';
    return `"${s}"`;
  }

  function getImplicitRole(el) {
    const explicit = el.getAttribute('role');
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (tag === 'button') return 'button';
    if (tag === 'a' && el.hasAttribute('href')) return 'link';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      return {checkbox:'checkbox', radio:'radio', button:'button', submit:'button',
              reset:'button', text:'textbox', search:'searchbox', email:'textbox',
              tel:'textbox', url:'textbox', password:'textbox', number:'spinbutton'}[type] || 'textbox';
    }
    return '';
  }

  function getAccessibleName(el) {
    const labelledBy = el.getAttribute('aria-labelledby');
    const labelText = labelledBy && document.getElementById(labelledBy)?.innerText?.trim();
    return (
      el.getAttribute('aria-label') ||
      labelText ||
      el.getAttribute('title') ||
      el.getAttribute('alt') ||
      el.getAttribute('placeholder') ||
      (el.tagName !== 'INPUT' && el.tagName !== 'SELECT'
        ? (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        : '') ||
      ''
    ).trim();
  }

  function getCommand(el) {
    const tag = el.tagName.toLowerCase();
    const role = getImplicitRole(el);
    const name = getAccessibleName(el);
    const candidates = [];

    for (const attr of ['data-testid','data-test-id','data-test','data-cy','data-qa']) {
      const val = (el.getAttribute(attr) || '').trim();
      if (val && looksStatic(val)) {
        candidates.push(attr === 'data-testid'
          ? [100, `get_by_test_id(${q(val)})`]
          : [98,  `locator(${q(`${tag}[${attr}='${val}']`, 400)})`]);
      }
    }

    const id = (el.getAttribute('id') || '').trim();
    if (id && looksStatic(id)) {
      const sel = /^[A-Za-z][\w-]*$/.test(id) ? `#${id}` : `${tag}[id='${id}']`;
      candidates.push([92, `locator(${q(sel, 400)})`]);
    }

    const nm = (el.getAttribute('name') || '').trim();
    if (nm && looksStatic(nm)) {
      candidates.push([84, `locator(${q(`${tag}[name='${nm}']`, 400)})`]);
    }

    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    if (ariaLabel && looksStatic(ariaLabel)) {
      candidates.push([76, `get_by_label(${q(ariaLabel)})`]);
    }

    if (role && name && looksStatic(name)) {
      candidates.push([72, `get_by_role(${q(role)}, name=${q(name)})`]);
    }

    const ph = (el.getAttribute('placeholder') || '').trim();
    if (ph && looksStatic(ph)) {
      candidates.push([64, `get_by_placeholder(${q(ph)})`]);
    }

    const stableClasses = (el.getAttribute('class') || '').split(/\s+/).filter(c => c && looksStatic(c));
    if (stableClasses.length) {
      const sel = tag + stableClasses.slice(0, 3).map(c => `.${c}`).join('');
      candidates.push([50 + Math.min(stableClasses.length, 3) * 3, `locator(${q(sel, 400)})`]);
    }

    if (role && name) {
      candidates.push([40, `get_by_role(${q(role)}, name=${q(name)})`]);
    }

    candidates.push([10, `locator(${q('xpath=' + getXPath(el), 400)})`]);
    candidates.sort((a, b) => b[0] - a[0]);
    return candidates[0][1];
  }

  function getXPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1) {
      let ix = 0, sib = node.previousSibling;
      while (sib) { if (sib.nodeType === 1 && sib.nodeName === node.nodeName) ix++; sib = sib.previousSibling; }
      parts.unshift(node.nodeName.toLowerCase() + (ix > 0 ? `[${ix+1}]` : ''));
      node = node.parentNode;
      if (!node || node.nodeType === 9) break;
    }
    return '/' + parts.join('/');
  }

  function getLabel(el) {
    let node = el;
    for (let i = 0; i < 5; i++) {
      if (!node || node === document.body) break;
      const name = getAccessibleName(node);
      if (name) return name.slice(0, 80);
      node = node.parentElement;
    }
    return getImplicitRole(el) || el.tagName.toLowerCase();
  }

  function findAnchorHref(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.tagName === 'A' && node.href && !node.href.startsWith('javascript:')) return node.href;
      node = node.parentElement;
    }
    return null;
  }

  // ── Event listeners ───────────────────────────────────────────────────────
  let scrollTimer = null;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      window.__recordAction({ type: 'scroll', scroll_x: Math.round(window.scrollX), scroll_y: Math.round(window.scrollY) });
    }, 500);
  }, { passive: true });

  document.addEventListener('click', function(e) {
    const el = e.target;
    if (el.id === '__bap_stop') return;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style'].includes(tag)) return;
    const href = findAnchorHref(el);
    window.__recordAction({ type: 'click', command: getCommand(el), label: getLabel(el), click_navigates: !!href, href: href || null });
  }, true);

  document.addEventListener('change', function(e) {
    const el = e.target;
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      window.__recordAction({ type: 'select', command: getCommand(el), value: el.value, label: el.options[el.selectedIndex]?.text || getLabel(el) });
    } else if (['input', 'textarea'].includes(tag)) {
      window.__recordAction({ type: 'fill', command: getCommand(el), value: el.value, label: getLabel(el) });
    }
  }, true);
})();
