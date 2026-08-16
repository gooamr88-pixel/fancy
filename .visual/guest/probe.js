// Injected into each dumped guest page: reports real geometry as plain text.
(function () {
  function report() {
    var stage = document.querySelector('#stage div[dir]');
    if (!stage) { document.body.textContent = 'NO SCROLL CONTAINER'; return; }
    var VW = window.innerWidth;
    var lines = [];
    lines.push('viewport ' + VW + 'x' + window.innerHeight);
    lines.push('scrollHeight ' + stage.scrollHeight);
    lines.push('--- sections (h vs viewport ' + window.innerHeight + ') ---');
    stage.querySelectorAll('[data-ha-section]').forEach(function (s) {
      var h = Math.round(s.getBoundingClientRect().height);
      lines.push((s.id || '?').padEnd(18) + ' h=' + String(h).padStart(5)
        + (h > window.innerHeight ? '   TALLER THAN THE FOLD' : ''));
    });

    lines.push('--- horizontal overflow ---');
    var out = [];
    stage.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Parked off-canvas on purpose (the download-capture card at -10000px):
      // entirely outside and clipped, not an overflow.
      if (r.right < -200 || r.left > VW + 200) return;
      var overR = r.right - VW;
      var overL = -r.left;
      if (overR <= 1 && overL <= 1) return;
      var sel = el.tagName.toLowerCase()
        + (el.id ? '#' + el.id : '')
        + (typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
      out.push(sel.padEnd(38)
        + (overL > 1 ? ' left -' + Math.round(overL) : '')
        + (overR > 1 ? ' right +' + Math.round(overR) : '')
        + '  "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 46) + '"');
    });
    lines.push(out.length ? out.join('\n') : 'none');

    lines.push('--- tiny text (< 11px) ---');
    var tiny = {};
    stage.querySelectorAll('*').forEach(function (el) {
      if (!el.children.length && (el.textContent || '').trim()) {
        var fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs && fs < 11) {
          var k = fs + 'px';
          tiny[k] = (tiny[k] || []);
          if (tiny[k].length < 3) tiny[k].push((el.textContent || '').trim().slice(0, 30));
        }
      }
    });
    var tk = Object.keys(tiny);
    lines.push(tk.length ? tk.map(function (k) { return k + ' — ' + tiny[k].join(' | '); }).join('\n') : 'none');

    document.body.innerHTML = '';
    var pre = document.createElement('pre');
    pre.textContent = lines.join('\n');
    document.body.appendChild(pre);
  }
  /* Synchronous. No React runs in this dump, so the DOM is final the moment
     the parser reaches this script — and --dump-dom prints at the load event,
     so ANY setTimeout means the report is never in the output. */
  report();
})();
