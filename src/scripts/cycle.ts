// Behaviour of the pitch's TriadCycle: 3 s step advance, 9 s orbiting dot, panel swap of 350 ms.
const STEP_MS = 3000;
const ORBIT_MS = 9000;
const CX = 240, CY = 230, R = 158;

export function startCycle(root: HTMLElement, reducedMotion: boolean) {
  const q = <T extends Element>(s: string) => [...root.querySelectorAll<T>(s)];
  const tabs = q<HTMLButtonElement>('[data-cy-tab]');
  const panels = q<HTMLElement>('[data-cy-panel]');
  const groups = ['arc', 'halo', 'node', 'icon', 'label'].map((n) => q<SVGElement>(`[data-cy-${n}]`));
  const dots = q<SVGCircleElement>('[data-cy-dot]');
  const count = root.querySelector('[data-cy-count]');
  let active = 0;
  let swap = 0;

  function paint() {
    tabs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === active)));
    for (const g of groups) g.forEach((el, i) => el.classList.toggle('on', i === active));
    if (count) count.textContent = `0${active + 1} / 03`;
  }

  function show(next: number) {
    if (next === active) return;
    const out = panels[active];
    active = next;
    paint();
    clearTimeout(swap);
    for (const p of panels) p.classList.remove('leaving', 'entering');
    const enter = () => {
      for (const p of panels) p.hidden = p !== panels[active];
      panels[active].classList.add('entering');
    };
    if (reducedMotion) { enter(); return; }
    out.classList.add('leaving');
    swap = window.setTimeout(enter, 350);
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  panels[0].classList.add('entering');
  paint();

  if (reducedMotion) return;

  setInterval(() => {
    if (root.offsetParent === null) return; // the tab holding the hero is not on screen
    show((active + 1) % 3);
  }, STEP_MS);

  let start: number | null = null;
  const orbit = (ts: number) => {
    start ??= ts;
    const p = ((ts - start) % ORBIT_MS) / ORBIT_MS;
    const a = ((-90 + 360 * p) * Math.PI) / 180;
    const x = (CX + R * Math.cos(a)).toFixed(1);
    const y = (CY + R * Math.sin(a)).toFixed(1);
    for (const d of dots) { d.setAttribute('cx', x); d.setAttribute('cy', y); }
    requestAnimationFrame(orbit);
  };
  requestAnimationFrame(orbit);
}
