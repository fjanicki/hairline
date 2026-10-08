import './craft.css';

// The colour toy's chip (docs/DESIGN.md R3.3): the live swatch in its true colour, the five tins
// (digit, colour, name, drops so far) and the two buttons. Every part is a <button>, so the UI's
// click-to-advance ignores it. Lives in the UI root; dispose() removes it.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * mixChip(ui, {tins: [{name, color}], labels: {tip, done, hint, tipKey, doneKey}, onTin(i), onTip(),
 * onDone()}) -> {set(hex, counts), shake(), relabel(labels, tins), dispose()}
 */
export function mixChip(ui, { tins, labels, onTin, onTip, onDone }) {
  const root = document.createElement('div');
  root.className = 'craft-chip mix-chip';
  root.innerHTML = `<div class="sw empty"></div><div class="tins">${tins
    .map(
      (t, i) =>
        `<button class="tin" data-i="${i}"><span class="dot" style="background:${esc(t.color)}">${i + 1}<span class="cnt"></span></span><span class="nm"></span></button>`,
    )
    .join('')}</div><button class="act tip"></button><button class="act done"></button>`;
  (ui.root || document.body).appendChild(root);
  const sw = root.querySelector('.sw');
  const cnts = [...root.querySelectorAll('.cnt')];
  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.querySelectorAll('.tin').forEach((b) =>
    b.addEventListener('click', (e) => {
      stop(e);
      onTin?.(+b.dataset.i);
    }),
  );
  root.querySelector('.tip').addEventListener('click', (e) => {
    stop(e);
    onTip?.();
  });
  root.querySelector('.done').addEventListener('click', (e) => {
    stop(e);
    onDone?.();
  });

  const relabel = (L = labels, T = tins) => {
    labels = L;
    tins = T;
    root.title = L.hint || '';
    root.querySelectorAll('.tin .nm').forEach((n, i) => (n.textContent = T[i]?.name ?? ''));
    const btn = (sel, text, key) => {
      const b = root.querySelector(sel);
      b.innerHTML = key ? `<span class="kbd">${esc(key)}</span>${esc(text)}` : esc(text);
    };
    btn('.tip', L.tip, L.tipKey);
    btn('.done', L.done, L.doneKey);
  };
  relabel();
  requestAnimationFrame(() => root.classList.add('show'));

  let shakeT = 0;
  return {
    el: root,
    set(hex, counts = []) {
      sw.classList.toggle('empty', !hex);
      sw.style.backgroundColor = hex || '';
      cnts.forEach((c, i) => {
        const n = counts[i] || 0;
        c.textContent = n ? String(n) : '';
        c.classList.toggle('on', n > 0);
      });
    },
    shake() {
      root.classList.remove('shake');
      void root.offsetWidth; // restart the animation
      root.classList.add('shake');
      clearTimeout(shakeT);
      shakeT = setTimeout(() => root.classList.remove('shake'), 450);
    },
    relabel,
    dispose() {
      clearTimeout(shakeT);
      root.classList.remove('show');
      setTimeout(() => root.remove(), 320);
    },
  };
}
