// Jaque Sehnem — prévia conceitual (Bruno Luque). "Duas portas na mesma porta."
// Camadas de motion:
//  - Assinatura: a porta automática do hero (duas folhas de vidro com mola) que se abre para a cabine e a loja.
//  - Narrativa: o divisor do comparador nasce de cima para baixo; a vitrine entra de lado; o retrato de "Quem atende"
//    se abre do centro como a porta; títulos por máscara de linha.
//  - Interface: pressão com retorno nos botões (CSS), CTA magnético (ponteiro fino), cápsula elástica do seletor, chips.
// Sem JS tudo fica visível: porta aberta, os dois lados lado a lado, vitrine com rolagem nativa.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const mobileMQ = matchMedia('(max-width: 860px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

/* tokens de motion (espelham as variáveis CSS) */
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const SPRING_DOOR = { stiffness: 125, damping: 15 };    // porta automática: leve passada e volta
const SPRING_DIVIDER = { stiffness: 300, damping: 30 }; // divisor: firme, quase sem sobra
const SPRING_MAGNET = { stiffness: 220, damping: 18 };

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const WA = 'https://wa.me/5548996104258?text=';
const wa = (msg) => WA + encodeURIComponent(msg);

/* ------------------------------------------------------------------ */
/* Mola 1D interrompível (preserva a velocidade ao trocar o alvo)      */
/* ------------------------------------------------------------------ */
function spring1(apply, { stiffness = 170, damping = 20, from = 0 } = {}) {
  const s = { x: from, v: 0, t: from, raf: 0, last: 0 };
  const tick = (now) => {
    const dt = Math.min(0.032, (now - (s.last || now)) / 1000 || 0.016); s.last = now;
    const f = -stiffness * (s.x - s.t) - damping * s.v;
    s.v += f * dt; s.x += s.v * dt;
    if (Math.abs(s.x - s.t) < 0.0004 && Math.abs(s.v) < 0.0004) { s.x = s.t; s.v = 0; s.raf = 0; s.last = 0; apply(s.x); return; }
    apply(s.x);
    s.raf = requestAnimationFrame(tick);
  };
  return {
    to(t) { s.t = t; if (!s.raf) s.raf = requestAnimationFrame(tick); },
    jump(x) { cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; s.x = s.t = x; s.v = 0; apply(x); },
    get value() { return s.x; },
    get target() { return s.t; },
  };
}
function spring2(apply, opts) {
  const sx = spring1((x) => apply(x, sy ? sy.value : 0), opts);
  const sy = spring1((y) => apply(sx.value, y), opts);
  return (x, y) => { sx.to(x); sy.to(y); };
}

/* ------------------------------------------------------------------ */
/* Topo translúcido e rolagem contínua (Lenis só na roda do mouse)     */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
const onScrollTop = () => top.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();

let lenis = null;
function startLenis() {
  if (reduce || !window.Lenis || lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });

function scrollToEl(target, offset) {
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: target.getBoundingClientRect().top + scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ */
/* ASSINATURA — a porta automática                                     */
/* ------------------------------------------------------------------ */
const store = $('[data-store]');
let door = null;
if (store) {
  const applyOpen = (v) => { store.style.setProperty('--open', v.toFixed(4)); };
  door = spring1(applyOpen, { ...SPRING_DOOR, from: reduce ? 1 : 0 });
  const open = () => { store.classList.add('is-open'); door.to(1); };
  const close = () => { store.classList.remove('is-open'); door.to(0); };
  if (reduce) { door.jump(1); store.classList.add('is-open'); }
  else {
    door.jump(0);
    // o sensor "vê" a visitante: abre logo após a pintura, ou antes se ela rolar/aproximar o ponteiro
    let opened = false;
    const first = () => { if (opened) return; opened = true; open(); };
    const timer = setTimeout(first, 650);
    addEventListener('scroll', () => { clearTimeout(timer); first(); }, { once: true, passive: true });
    store.addEventListener('pointerenter', () => { clearTimeout(timer); first(); }, { once: true });
    // quando a fachada sai da tela a porta se fecha; ao voltar, abre de novo
    const io = new IntersectionObserver(([e]) => {
      if (!opened) return;
      if (e.isIntersecting) open(); else close();
    }, { threshold: 0.12 });
    io.observe(store);
  }
}

/* ------------------------------------------------------------------ */
/* SELETOR DE LADO — comparador com divisor móvel + cápsula elástica   */
/* ------------------------------------------------------------------ */
const cmp = $('[data-cmp]');
const seg = $('[data-seg]');
const segPill = $('[data-seg-pill]');
const segBtns = seg ? $$('button', seg) : [];
const divider = $('[data-divider]');
let setSide = () => {};
let motionAnimate = null; // preenchido quando o Motion carrega

// mensagens do WhatsApp por lado (funciona sem o comparador)
const msgCabine = (v) => `Olá, Jaque! Vim pelo site e quero agendar um horário de ${v} na cabine.`;
const msgPrat = (v) => `Olá, Jaque! Vim pelo site e quero saber se tem produtos de ${v} na loja.`;
$$('[data-picks]').forEach((fs) => {
  const kind = fs.dataset.picks;
  const link = $(`[data-wa="${kind}"]`);
  fs.addEventListener('change', () => {
    const v = $('input:checked', fs)?.value; if (!v || !link) return;
    link.href = wa(kind === 'cabine' ? msgCabine(v) : msgPrat(v));
  });
});

if (cmp && divider) {
  cmp.classList.add('is-live');
  seg && seg.classList.add('is-live');
  const contentA = $('.side--cabine [data-side-content]', cmp);
  const contentB = $('.side--prateleira [data-side-content]', cmp);
  const tabA = $('.side--cabine .side__tab', cmp);
  const tabB = $('.side--prateleira .side__tab', cmp);
  let W = 1, aRight = 0, bLeft = 0, pA = 78, pB = 22, segState = '';
  const measure = () => {
    W = cmp.clientWidth || 1;
    aRight = contentA.offsetLeft + contentA.offsetWidth;
    bLeft = contentB.offsetLeft;
    const needA = ((aRight + 18) / W) * 100;
    const needB = ((bLeft - 18) / W) * 100;
    pA = Math.min(97, mobileMQ.matches ? needA : Math.max(80, needA));
    pB = Math.max(3, mobileMQ.matches ? needB : Math.min(22, needB));
  };
  const render = (p) => {
    const x = (p / 100) * W;
    const ca = clamp((x - aRight) / 56 + 1);
    const cb = clamp((bLeft - x) / 56 + 1);
    cmp.style.setProperty('--p', p.toFixed(3));
    cmp.style.setProperty('--ca', ca.toFixed(3));
    cmp.style.setProperty('--cb', cb.toFixed(3));
    contentA.toggleAttribute('data-hidden', ca < 0.04);
    contentB.toggleAttribute('data-hidden', cb < 0.04);
    tabA.classList.toggle('is-on', ca < 0.5);
    tabB.classList.toggle('is-on', cb < 0.5);
    tabA.classList.toggle('is-narrow', x < 110);
    tabB.classList.toggle('is-narrow', W - x < 110);
    const state = ca < 0.5 && cb >= 0.5 ? 'prateleira' : cb < 0.5 && ca >= 0.5 ? 'cabine' : 'ambos';
    if (state !== segState) { segState = state; markSeg(state, true); }
    const n = Math.round(p);
    if (divider._n !== n) {
      divider._n = n;
      divider.setAttribute('aria-valuenow', String(n));
      divider.setAttribute('aria-valuetext', state === 'cabine' ? 'Lado da cabine em destaque' : state === 'prateleira' ? 'Lado da prateleira em destaque' : 'Os dois lados');
    }
  };
  const pSpring = spring1(render, { ...SPRING_DIVIDER, from: 50 });
  const go = (p, instant) => (instant || reduce ? pSpring.jump(p) : pSpring.to(p));
  setSide = (side, instant) => go(side === 'cabine' ? pA : side === 'prateleira' ? pB : 50, instant);

  // cápsula elástica do seletor: estica até cobrir as duas opções e depois assenta na nova medida
  function markSeg(state, animate) {
    let target = null;
    segBtns.forEach((b) => { const on = b.dataset.side === state; b.setAttribute('aria-pressed', String(on)); if (on) target = b; });
    if (!target || !segPill) return;
    const sr = seg.getBoundingClientRect(), tr = target.getBoundingClientRect(), pr = segPill.getBoundingClientRect();
    const tx = tr.left - sr.left, tw = tr.width;
    const cx = pr.width ? pr.left - sr.left : tx, cw = pr.width || tw;
    if (!animate || reduce || !motionAnimate || !pr.width) {
      segPill.style.transform = `translateX(${tx}px)`; segPill.style.width = tw + 'px'; return;
    }
    const ux = Math.min(cx, tx), uw = Math.max(cx + cw, tx + tw) - ux;
    motionAnimate(segPill, {
      transform: [`translateX(${cx}px)`, `translateX(${ux}px)`, `translateX(${tx}px)`],
      width: [cw + 'px', uw + 'px', tw + 'px'],
    }, { duration: 0.5, times: [0, 0.42, 1], ease: [EASE_IN_OUT, EASE_OUT] });
  }
  segBtns.forEach((b) => b.addEventListener('click', () => setSide(b.dataset.side)));

  // arrastar o divisor (ponteiro e toque); a página continua rolando na vertical
  let dragging = false, startX = 0, moved = false;
  const pFromX = (clientX) => clamp(((clientX - cmp.getBoundingClientRect().left) / W) * 100, 2, 98);
  divider.addEventListener('pointerdown', (e) => {
    dragging = true; moved = false; startX = e.clientX;
    divider.setPointerCapture(e.pointerId); cmp.classList.add('is-dragging');
  });
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 3) moved = true;
    pSpring.jump(pFromX(e.clientX));
  });
  const endDrag = () => {
    if (!dragging) return; dragging = false; cmp.classList.remove('is-dragging');
    const p = pSpring.value;
    const snaps = [pB, 50, pA];
    const near = snaps.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
    go(near);
  };
  divider.addEventListener('pointerup', endDrag);
  divider.addEventListener('pointercancel', endDrag);
  divider.addEventListener('click', (e) => { if (!moved) { e.preventDefault(); } });
  divider.addEventListener('keydown', (e) => {
    const p = pSpring.target;
    const map = { ArrowLeft: p - 4, ArrowDown: p - 4, ArrowRight: p + 4, ArrowUp: p + 4, PageDown: p - 15, PageUp: p + 15, Home: pB, End: pA };
    if (!(e.key in map)) return;
    e.preventDefault();
    go(clamp(map[e.key], 2, 98));
  });
  // tocar num lado (fora de links e campos) traz esse lado para frente
  cmp.addEventListener('click', (e) => {
    if (e.target.closest('a, input, label, [data-divider], .seg')) return;
    const tab = e.target.closest('[data-tab]');
    if (tab) { setSide(tab.dataset.tab); return; }
    const x = (e.clientX - cmp.getBoundingClientRect().left) / W * 100;
    setSide(x < pSpring.value ? 'cabine' : 'prateleira');
  });

  measure();
  pSpring.jump(50);
  const ro = new ResizeObserver(() => { measure(); render(pSpring.value); markSeg(segState, false); });
  ro.observe(cmp);
  document.fonts?.ready.then(() => { measure(); render(pSpring.value); markSeg(segState, false); });
}

// atalhos que escolhem o lado: placas da porta e menu
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#inicio' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  const offset = id === '#inicio' ? 0 : -(top.offsetHeight + 8);
  scrollToEl(id === '#inicio' ? document.body : target, offset);
  if (a.dataset.pick) setTimeout(() => setSide(a.dataset.pick), reduce ? 0 : 520);
  if (id !== '#inicio') { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
});

/* ------------------------------------------------------------------ */
/* VITRINE — carrossel com troca de protagonismo                       */
/* ------------------------------------------------------------------ */
const track = $('[data-track]');
if (track) {
  const cards = $$('.card', track);
  const prev = $('[data-prev]'), next = $('[data-next]'), count = $('[data-count]');
  let idx = 0, raf = 0;
  if (!reduce) track.classList.add('is-live');
  const update = () => {
    raf = 0;
    const tr = track.getBoundingClientRect();
    const mid = tr.left + tr.width / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
      if (!reduce) { const f = clamp(1 - d / (r.width * 1.1)).toFixed(3); if (c._f !== f) { c._f = f; c.style.setProperty('--f', f); } }
    });
    if (best !== idx || !count.textContent) { idx = best; count.textContent = String(idx + 1).padStart(2, '0'); }
    prev.disabled = idx === 0; next.disabled = idx === cards.length - 1;
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  track.addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  const goTo = (i) => {
    const c = cards[clamp(i, 0, cards.length - 1)];
    const tr = track.getBoundingClientRect(), r = c.getBoundingClientRect();
    track.scrollBy({ left: r.left + r.width / 2 - (tr.left + tr.width / 2), behavior: reduce ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => goTo(idx - 1));
  next.addEventListener('click', () => goTo(idx + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(idx - 1); }
  });
  // começa no segundo cartão para mostrar que há vizinhos dos dois lados
  requestAnimationFrame(() => { const c = cards[1]; if (c) track.scrollLeft += c.getBoundingClientRect().left + c.offsetWidth / 2 - (track.getBoundingClientRect().left + track.clientWidth / 2); update(); });
}

/* ------------------------------------------------------------------ */
/* CTA magnético (só ponteiro fino; usa `translate`, livre do :active) */
/* ------------------------------------------------------------------ */
if (!reduce && fineMQ.matches) {
  $$('[data-magnetic]').forEach((b) => {
    const set = spring2((x, y) => { b.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`; }, SPRING_MAGNET);
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      set((e.clientX - r.left - r.width / 2) * 0.16, (e.clientY - r.top - r.height / 2) * 0.28);
    });
    b.addEventListener('pointerleave', () => set(0, 0));
  });
}

/* ------------------------------------------------------------------ */
/* Botão fixo no celular: aparece depois da fachada, some no "Visite"  */
/* ------------------------------------------------------------------ */
const dock = $('[data-dock]');
if (dock && 'IntersectionObserver' in window) {
  const vis = { hero: true, end: false };
  const sync = () => dock.classList.toggle('is-on', !vis.hero && !vis.end);
  new IntersectionObserver(([e]) => { vis.hero = e.isIntersecting; sync(); }, { threshold: 0 }).observe($('[data-hero] .hero__actions'));
  const endObs = new IntersectionObserver((es) => { es.forEach((e) => { e.target._in = e.isIntersecting; }); vis.end = [$('#visite'), $('.foot')].some((x) => x._in); sync(); });
  endObs.observe($('#visite')); endObs.observe($('.foot'));
}

/* ------------------------------------------------------------------ */
/* Motion: coreografia de entrada e narrativa                           */
/* ------------------------------------------------------------------ */
const M = window.Motion || null;
if (!M) console.warn('Motion indisponível; a página segue estática.');

if (M) {
  const { animate, scroll, inView, stagger } = M;
  motionAnimate = (...a) => animate(...a);
  const prog = (p) => (typeof p === 'number' ? p : p?.y?.progress ?? 0);
  root.classList.add('motion-ready');

  if (!reduce) {
    /* HERO: título por máscara de linha (line-mask); CTA já está visível desde o primeiro quadro */
    animate('.hero__title .line > span', { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 0.9, delay: stagger(0.07), ease: EASE_OUT });
    animate('.eyebrow, .hero__lead, .hero__place', { opacity: [0, 1] }, { duration: 0.7, delay: stagger(0.08, { startDelay: 0.25 }), ease: EASE_OUT });

    /* HERO: ao rolar, a fachada se aproxima como quem entra */
    if (!mobileMQ.matches) {
      const heroCopy = $('.hero__copy');
      scroll((p) => {
        const t = prog(p);
        store.style.transform = `translateY(${(t * -5).toFixed(2)}%) scale(${(1 + t * 0.07).toFixed(4)})`;
        heroCopy.style.transform = `translateY(${(t * -9).toFixed(2)}%)`;
        heroCopy.style.opacity = String(1 - t * 0.7);
      }, { target: $('[data-hero]'), offset: ['start start', 'end start'] });
    }

    /* NARRATIVA 1 — a junção da porta vira o divisor: a linha nasce de cima e a divisão dá um respiro */
    const line = $('.cmp__line'), knob = $('.cmp__knob');
    if (line && cmp) {
      line.style.transform = 'scaleY(0)'; knob.style.opacity = '0';
      inView(cmp, () => {
        animate(line, { transform: ['scaleY(0)', 'scaleY(1)'] }, { duration: 0.9, ease: EASE_IN_OUT });
        animate(knob, { opacity: [0, 1], transform: ['scale(.4)', 'scale(1)'] }, { duration: 0.5, delay: 0.55, type: 'spring', bounce: 0.35 })
          .then(() => { knob.style.transform = ''; });
        const shown = $$('.cmp .side__content:not([data-hidden])');
        if (shown.length) animate(shown, { opacity: [0, 1] }, { duration: 0.6, delay: 0.25, ease: EASE_OUT })
          .then(() => shown.forEach((c) => (c.style.opacity = '')));
      }, { amount: 0.3 });
    }

    /* NARRATIVA 2 — a vitrine desliza de lado, como uma prateleira que chega */
    if (track) {
      track.style.transform = 'translateX(14%)'; track.style.opacity = '0';
      inView(track, () => {
        animate(track, { transform: ['translateX(14%)', 'translateX(0%)'], opacity: [0, 1] }, { duration: 1.1, ease: EASE_OUT })
          .then(() => { track.style.transform = ''; });
      }, { amount: 0.2 });
    }

    /* NARRATIVA 3 — o retrato de "Quem atende" se abre do centro, como a porta; os três itens sobem por máscara */
    const qPhoto = $('[data-quem-photo] img');
    if (qPhoto) {
      qPhoto.style.clipPath = 'inset(0 50% 0 50%)';
      inView($('[data-quem-photo]'), () => {
        animate(qPhoto, { clipPath: ['inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.1, ease: EASE_IN_OUT });
        animate(qPhoto, { transform: ['scale(1.12)', 'scale(1)'] }, { duration: 1.5, ease: EASE_OUT });
      }, { amount: 0.25 });
    }
    const qItems = $$('[data-quem-list] .l > span');
    if (qItems.length) {
      qItems.forEach((s) => (s.style.transform = 'translateY(110%)'));
      inView($('[data-quem-list]'), () => {
        animate(qItems, { transform: ['translateY(110%)', 'translateY(0%)'] }, { duration: 0.85, delay: stagger(0.1), ease: EASE_OUT });
      }, { amount: 0.3 });
    }

    /* títulos de seção por máscara de linha (line-mask) */
    $$('.lados .h2, .vitrine .h2, .visite .h2').forEach((h) => {
      if (h.getBoundingClientRect().top < innerHeight) return;
      h.style.clipPath = 'inset(0% 0% 100% 0%)'; h.style.transform = 'translateY(28px)';
      inView(h.parentElement, () => {
        animate(h, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% -14% 0%)'], transform: ['translateY(28px)', 'translateY(0px)'] }, { duration: 0.95, ease: EASE_OUT });
      }, { amount: 0.2 });
    });
  }
}
