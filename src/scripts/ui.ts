import { startCycle } from './cycle';
import { startField, type FieldController } from './field';
import { startTransform } from './transform';

const STORAGE_KEY = 'vc-lang';
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Language: only an explicit click is remembered. navigator.language is deliberately never read.
const langLinks = $$<HTMLAnchorElement>('[data-lang-link]');
for (const a of langLinks) {
  a.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEY, a.dataset.langLink!); } catch { /* storage unavailable */ }
  });
}

// Two main tabs. Without JavaScript both panels simply stack.
const panels = $$<HTMLElement>('[data-tabpanel]');
const tabLinks = $$<HTMLAnchorElement>('[data-maintab]');
const cap = document.querySelector<HTMLElement>('[data-figcap]');
const count = document.querySelector<HTMLElement>('[data-figcount]');
let field: FieldController | null = null;
let sections: HTMLElement[] = [];
let activeTab = 'business';

function setHash(id: string) {
  for (const a of langLinks) a.href = `${a.pathname}#${id}`;
}

function onScene(i: number) {
  const s = sections[i];
  if (!s) return;
  setHash(s.id === 'cycle' ? activeTab : s.id);
  const figures = [...new Set(sections.map((x) => x.dataset.fig).filter(Boolean))];
  if (cap) cap.textContent = s.dataset.fig ?? '';
  if (count) count.textContent = s.dataset.fig
    ? `${String(figures.indexOf(s.dataset.fig) + 1).padStart(2, '0')} / ${String(figures.length).padStart(2, '0')}`
    : '';
}

function selectTab(name: string, scrollTop: boolean) {
  activeTab = name;
  for (const p of panels) p.hidden = p.dataset.tabpanel !== name;
  for (const a of tabLinks) {
    if (a.dataset.maintab === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  sections = $$<HTMLElement>('[data-scene]', panels.find((p) => !p.hidden)!);
  field?.setSections(sections);
  setHash(name);
  if (scrollTop) scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

function tabFromHash(): string {
  const id = location.hash.slice(1);
  if (!id) return 'business';
  const el = document.getElementById(id);
  const owner = el?.closest<HTMLElement>('[data-tabpanel]');
  return owner?.dataset.tabpanel ?? 'business';
}

for (const a of tabLinks) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    selectTab(a.dataset.maintab!, true);
    history.replaceState(null, '', `#${a.dataset.maintab}`);
  });
}
addEventListener('hashchange', () => selectTab(tabFromHash(), false));

const initial = tabFromHash();
for (const p of panels) p.hidden = p.dataset.tabpanel !== initial;
activeTab = initial;
sections = $$<HTMLElement>('[data-scene]', panels.find((p) => !p.hidden)!);

// Background field.
const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
if (canvas) {
  try {
    field = startField({ canvas, sections, reducedMotion, onScene });
  } catch (error) {
    console.warn('Background field disabled, using the static figure:', error);
  }
}
document.documentElement.classList.add(field ? 'webgl' : 'no-webgl');
selectTab(initial, false);
if (location.hash && location.hash.length > 1 && !['#business', '#proof'].includes(location.hash)) {
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

// Header background after the hero starts to scroll.
const header = document.querySelector('[data-header]');
const onScroll = () => header?.classList.toggle('scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Hero and slider ported from the pitch.
const cycle = document.querySelector<HTMLElement>('[data-cycle]');
if (cycle) startCycle(cycle, reducedMotion);
const transform = document.querySelector<HTMLElement>('[data-transform]');
if (transform) startTransform(transform);

// Reveal on entry. Content is visible by default if this script never runs.
if (!reducedMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  for (const el of $$('[data-reveal]')) { el.classList.add('pre'); io.observe(el); }
}

// Accessible tabs for the five questions.
for (const root of $$<HTMLElement>('[data-tabs]')) {
  const list = root.querySelector<HTMLElement>('[data-tablist]')!;
  const tabs = $$<HTMLButtonElement>('[data-tab]', root);
  const inner = $$<HTMLElement>('[data-panel]', root);
  list.setAttribute('role', 'tablist');
  const uid = root.dataset.tabs!;

  const select = (key: string, focus = false) => {
    for (const t of tabs) {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    }
    for (const p of inner) p.hidden = p.dataset.panel !== key;
  };

  tabs.forEach((t, i) => {
    t.setAttribute('role', 'tab');
    t.id = `${uid}-tab-${t.dataset.tab}`;
    t.setAttribute('aria-controls', `${uid}-panel-${t.dataset.tab}`);
    t.addEventListener('click', () => select(t.dataset.tab!));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length].dataset.tab!, true); }
    });
  });
  for (const p of inner) {
    p.setAttribute('role', 'tabpanel');
    p.id = `${uid}-panel-${p.dataset.panel}`;
    p.setAttribute('aria-labelledby', `${uid}-tab-${p.dataset.panel}`);
    p.tabIndex = 0;
  }
  select(tabs[0].dataset.tab!);
}

// Chart tooltip. Every value is also in the table view.
const tip = document.querySelector<HTMLElement>('[data-tip-box]');
const chart = tip?.parentElement;
if (tip && chart) {
  const move = (row: HTMLElement, x: number, y: number) => {
    tip.textContent = row.dataset.tip ?? '';
    tip.hidden = false;
    const box = chart.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = `${Math.min(box.width - w - 8, Math.max(8, x - box.left + 14))}px`;
    tip.style.top = `${Math.max(8, y - box.top - h - 12)}px`;
  };
  for (const row of $$<HTMLElement>('[data-tip]', chart)) {
    row.addEventListener('pointermove', (e) => move(row, e.clientX, e.clientY));
    row.addEventListener('pointerdown', (e) => move(row, e.clientX, e.clientY));
    row.addEventListener('pointerleave', () => { tip.hidden = true; });
  }
}
