import type { Dict } from '../content';

// Behaviour of the pitch's TransformDemo: same reveal thresholds, drag, keys and auto-play rate.
const p01 = (x: number, min: number, max: number) => Math.max(0, Math.min(1, (x - min) / (max - min)));

export function startTransform(root: HTMLElement) {
  const data = JSON.parse(root.querySelector('[data-transform-json]')!.textContent!) as Dict['transform'];
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement>(s: string) => [...root.querySelectorAll<T>(s)];
  const track = $('[data-tf-track]');
  const fill = $('[data-tf-fill]');
  const thumb = $('[data-tf-thumb]');
  const pct = $('[data-tf-pct]');
  const term = $('[data-tf-term]');
  const lines = $('[data-tf-lines]');
  const playBtn = $<HTMLButtonElement>('[data-tf-play]');
  const insight = $('[data-tf-insight]');
  const badge = $('[data-tf-stagebadge] b');
  const reveal = {
    cluster: $('[data-tf-a=cluster]'),
    insight: $('[data-tf-a=insight]'),
    action: $('[data-tf-a=action]'),
    api: $('[data-tf-a=api]'),
  };

  let idx = 0;
  let progress = 10;
  let timer = 0;
  let dragging = false;

  const fade = (el: HTMLElement, a: number, blur: number) => {
    el.style.opacity = String(a);
    el.style.filter = blur ? `blur(${(1 - a) * blur}px)` : '';
    el.style.transform = blur ? `translateY(${(1 - a) * blur}px)` : '';
  };

  function render() {
    const m = data.markers[idx];
    const stage = progress < 33 ? 0 : progress < 66 ? 1 : 2;
    const a = p01(progress, 22, 45), b = p01(progress, 55, 72), c = p01(progress, 68, 85), d = p01(progress, 82, 96);
    fill.style.width = `${progress}%`;
    thumb.style.left = `calc(${progress}% - 18px)`;
    pct.textContent = `${Math.round(progress)}%`;
    track.setAttribute('aria-valuenow', String(Math.round(progress)));
    term.style.opacity = String(Math.max(0.15, 1 - p01(progress, 38, 88)));
    fade(reveal.cluster, a, 10);
    fade(reveal.insight, b, 8);
    fade(reveal.action, c, 0);
    fade(reveal.api, d, 0);
    const chars = Math.round(p01(progress, 60, 98) * m.insight.length);
    insight.textContent = m.insight.slice(0, chars);
    insight.classList.toggle('typing', chars > 0 && chars < m.insight.length);
    if (badge.textContent !== data.stages[stage]) badge.textContent = data.stages[stage];
    $$('[data-tf-stage]').forEach((s, i) => {
      s.classList.toggle('on', progress >= [0, 33, 66][i]);
      s.classList.toggle('now', i === stage);
    });
    $$('[data-tf-dot]').forEach((s, i) => { s.classList.toggle('on', stage >= i); s.classList.toggle('now', stage === i); });
    $$('[data-tf-dotl]').forEach((s, i) => s.classList.toggle('on', stage >= i));
    $$('[data-tf-line]').forEach((s, i) => s.classList.toggle('on', stage > i));
  }

  function loadMarker() {
    const m = data.markers[idx];
    $$('[data-tf-marker]').forEach((b, i) => b.setAttribute('aria-pressed', String(i === idx)));
    lines.replaceChildren(...m.terminal.map((l, i) => {
      const div = document.createElement('div');
      div.className = l.startsWith('$') ? 'c' : l.startsWith('>') ? 'o' : 'e';
      div.style.setProperty('--i', String(i));
      div.textContent = l || ' ';
      return div;
    }));
    const cursor = document.createElement('span');
    cursor.className = 'tf-cursor';
    cursor.textContent = '▋';
    lines.append(cursor);
    $('[data-tf-state]').textContent = m.state;
    $('[data-tf-group]').textContent = m.group;
    $('[data-tf-gene]').textContent = `${m.gene} · ${m.genotype}`;
    $('[data-tf-ico]').style.background = m.color;
    $$('[data-tf-dim]').forEach((d, i) => { d.textContent = m.dims[i]; });
    $('[data-tf-action]').textContent = m.action;
    $('[data-tf-api]').textContent = `{ variant: "${m.apiVariant}", state: "${m.stateCode}", risk: "${m.risk}", abstain: ${m.abstain} }`;
  }

  const stop = () => {
    clearInterval(timer);
    timer = 0;
    playBtn.textContent = data.play;
    playBtn.classList.remove('on');
  };
  const set = (v: number) => { progress = Math.max(0, Math.min(100, v)); render(); };
  const fromX = (x: number) => {
    const r = track.getBoundingClientRect();
    return ((x - r.left) / r.width) * 100;
  };

  $$('[data-tf-marker]').forEach((b, i) => b.addEventListener('click', () => {
    stop(); idx = i; loadMarker(); set(10);
  }));

  track.addEventListener('pointerdown', (e) => {
    dragging = true; stop(); track.setPointerCapture(e.pointerId); set(fromX(e.clientX));
  });
  track.addEventListener('pointermove', (e) => { if (dragging) set(fromX(e.clientX)); });
  track.addEventListener('pointerup', () => { dragging = false; });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); stop(); set(progress + 5); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); set(progress - 5); }
  });

  playBtn.addEventListener('click', () => {
    if (timer) { stop(); return; }
    set(0);
    playBtn.textContent = data.playing;
    playBtn.classList.add('on');
    timer = window.setInterval(() => {
      if (progress >= 100) { stop(); set(100); return; }
      set(progress + 0.7);
    }, 18);
  });

  loadMarker();
  set(10);
}
