import { demoDicts, FINDINGS, LABS, QUEUE, type FindingData, type LabData } from '../content/demo';
import { startField } from './field';

const lang = (document.body.dataset.lang === 'en' ? 'en' : 'ru') as 'ru' | 'en';
const D = demoDicts[lang];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE = 'vc-demo-v1';

interface State {
  screen: number;
  imported: boolean;
  logN: number;
  consent: boolean;
  labs: Record<string, boolean>;
  decisions: Record<string, string>;
  plan: Record<string, boolean>;
  visit: number;
  feed: string[];
  apiFinding: string;
  guideOn: boolean;
  guideStep: number;
}

const fresh = (): State => ({
  screen: 0, imported: false, logN: 0, consent: false, labs: {}, decisions: {}, plan: {}, visit: 1, feed: [],
  apiFinding: 't2d', guideOn: true, guideStep: 0,
});

function load(): State {
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return fresh();
}

let S = load();
let openFinding: string | null = null;
let importing = false;
let auto = 0;
let scripted = false; // the last tour step changed state on the visitor's behalf
let pendingConsent = false;
let shownFinding: string | null = null;
let drawerOpener: HTMLElement | null = null;
let modalOpener: HTMLElement | null = null;
const save =() => { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch { /* storage unavailable */ } };

const q = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const main = q('[data-d-main]');
const nav = q('[data-d-nav]');
const guide = q('[data-d-guide]');
const drawer = q('[data-d-drawer]');
const modal = q('[data-d-modal]');

const numberFormat = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 3 });
const num = (n: number) => numberFormat.format(n); // display only; the JSON preview keeps raw numbers
const NB = '\u00a0';
const finding = (id: string) => FINDINGS.find((f) => f.id === id)!;
const text = (id: string) => D.findings[id as keyof typeof D.findings];
const labText = (id: string) => D.labs.items[id as keyof typeof D.labs.items];
const stateOf = (f: FindingData) => D.states[f.state];
const STATE_CLASS: Record<string, string> = {
  supported_association_risk_not_estimable: 'ok', requires_qualified_clinical_review: 'review', variant_or_allele_unresolved: 'stop',
  conflicting_evidence: 'warn', transferability_uncertain: 'warn', insufficient_evidence: 'mute',
};
const stateChip = (f: FindingData) => `<span class="st ${STATE_CLASS[f.state]}">${esc(stateOf(f).label)}</span>`;

const visible = () => FINDINGS.filter((f) => !f.sensitive || S.consent);
const labValue = (l: LabData) => (S.visit > 1 && l.retest !== undefined ? l.retest : l.value);
const labHigh = (l: LabData) => (S.visit > 1 && l.retest !== undefined ? !!l.retestHigh : l.high);
const queue = () => QUEUE.filter((i) => (i.needsLab ? S.labs[i.needsLab] : true) && (i.needsConsent ? S.consent : true));

function gateJson(f: FindingData) {
  const t = text(f.id);
  return {
    demo: true,
    patient: 'synthetic:alexey-ivanov',
    question_type: f.questionType,
    state: f.state,
    variant: { id: f.variantId, rsid: f.rsid, genotype: f.genotype, harmonization: f.harmonization },
    evidence: { ...f.api, grade: null, grade_reason: 'no approved thresholds' },
    transferability: { allele_frequency: { allele: f.altLabel, ...f.freq }, ancestry_used_as_coefficient: false },
    risk: { status: f.riskStatus, percentage: null },
    observations: f.labs.filter((id) => S.labs[id]).map((id) => {
      const l = LABS.find((x) => x.id === id)!;
      return { lab: id, value: labValue(l), unit: labText(id).unit };
    }),
    limitations: t.limits,
    provenance: { source: 'GWAS Catalog, consolidated layer', checks_run: '20261105-204433-d719', frequencies: 'ALFA', method_version: 'demo' },
  };
}

function patientCard() {
  const initials = D.patient.name.split(/\s+/).map((w) => w[0]).join('');
  return `<div class="d-patient"><div class="av" aria-hidden="true">${esc(initials)}</div><div><b>${esc(D.patient.name)}</b><span>${esc(D.patient.meta)}</span></div><p>${esc(D.patient.context)}</p></div>`;
}

function screenImport() {
  const s = D.importScreen;
  const lines = s.log.slice(0, S.logN).map((l) => `<div class="${l.startsWith('$') ? 'c' : 'o'}">${esc(l)}</div>`).join('');
  const done = S.imported;
  return `<div class="d-grid">
    <section>
      <p class="kicker">${esc(s.kicker)}</p><h1>${esc(s.title)}</h1><p class="body">${esc(s.body)}</p>
      ${patientCard()}
      ${done
        ? `<button class="btn" data-act="go" data-v="1" data-demo="done">${esc(s.done)}</button>`
        : `<button class="d-drop" data-act="import" data-demo="drop" ${importing ? 'disabled' : ''}><b>${esc(importing ? s.running : s.drop)}</b><span>${esc(D.patient.file)}</span></button>`}
      <p class="note">${esc(s.dropNote)}</p>
    </section>
    <section class="tf-term d-term" data-demo="terminal"><div class="tf-chrome"><i></i><i></i><i></i><span>vita-codex</span><span class="d-sim">${esc(s.simulated)}</span></div>
      <div class="d-lines">${lines || '<div class="e">_</div>'}</div></section>
  </div>`;
}

function requireImport() {
  return `<div class="d-empty"><p>${esc(D.importScreen.body)}</p><button class="btn" data-act="go" data-v="0">${esc(D.ui.nav[0])}</button></div>`;
}

function screenResults() {
  const r = D.results;
  const cards = visible().map((f) => {
    const t = text(f.id);
    return `<button class="d-card" data-act="finding" data-v="${f.id}" data-demo="f-${f.id}">
      <span class="d-gene">${esc(f.gene)} · ${esc(f.genotype)}</span>
      <h3>${esc(t.q)}</h3>
      ${stateChip(f)}
      <p>${esc(t.short)}</p>
      <em>${esc(r.open)} →</em>
    </button>`;
  }).join('');
  const locked = S.consent ? '' : `<div class="d-card locked" data-demo="locked"><span class="d-gene">ClinVar</span><h3>${esc(r.lockedTitle)}</h3><p>${esc(r.lockedBody)}</p><button class="btn small" data-act="consent">${esc(r.lockedCta)}</button></div>`;
  return `<p class="kicker">${esc(r.kicker)}</p><h1>${esc(r.title)}</h1>
    <p class="d-noscore" data-demo="noscore">${esc(r.noScore)}</p>
    <div class="d-cards">${cards}${locked}</div>
    <div class="d-three">
      <article class="plate"><p class="label">${esc(r.ancestryTitle)}</p><p class="body small">${esc(r.ancestryBody)}</p></article>
      <article class="plate"><p class="label">${esc(r.catalogTitle)}</p><p class="body small">${esc(r.catalogBody)}</p></article>
      <article class="plate"><p class="label">${esc(r.hypothesisTitle)}</p><p class="body small">${esc(r.hypothesisBody)}</p><p class="tagtext">${esc(r.hypothesisTag)}</p></article>
    </div>
    <div class="d-next"><button class="btn" data-act="go" data-v="2">${esc(D.ui.continueTo)}: ${esc(D.ui.nav[2])}</button></div>`;
}

function screenLabs() {
  const L = D.labs;
  const labRow = (l: LabData) => {
    const t = labText(l.id);
    const on = S.labs[l.id];
    const high = labHigh(l);
    return `<li class="d-lab ${on ? 'on' : ''}" data-demo="lab-${l.id}">
      <div class="n"><b>${esc(t.name)}</b><span>${esc(finding(l.finding).gene)} · ${esc(L.refPrefix)} ${esc(t.ref)}${NB}${esc(t.unit)}</span>${t.note ? `<small>${esc(t.note)}</small>` : ''}</div>
      ${on
        ? `<div class="v"><b>${num(labValue(l))}</b>${NB}<span>${esc(t.unit)}</span><i class="${high ? 'hi' : 'ok'}">${esc(high ? L.above : L.inRange)}</i>${S.visit > 1 && l.retest !== undefined ? `<small>${num(l.value)} → ${num(l.retest)} · ${esc(L.visit2)}</small>` : ''}</div>`
        : `<button class="d-mini" data-act="lab" data-v="${l.id}">${esc(L.pull)}</button>`}
    </li>`;
  };
  const group = (title: string, items: LabData[]) => `<p class="label d-labsec">${esc(title)}</p><ul class="d-labs">${items.map(labRow).join('')}</ul>`;
  const rows = group(L.sections.lab, LABS.filter((l) => !l.kind)) + group(L.sections.anthro, LABS.filter((l) => l.kind === 'anthro'));
  const feed = S.feed.slice().reverse().map((id) => `<li><b>${esc(labText(id).name)}</b><span>${esc(labText(id).effect)}</span></li>`).join('');
  return `<div class="d-grid wide">
    <section><p class="kicker">${esc(L.kicker)}</p><h1>${esc(L.title)}</h1><p class="body">${esc(L.body)}</p>
      <button class="btn" data-act="labsAll" data-demo="labsAll">${esc(L.pullAll)}</button>
      ${rows}<p class="note">${esc(L.refNote)}</p></section>
    <section class="plate d-feed" data-demo="feed"><p class="label">${esc(L.feed)}</p>
      ${feed ? `<ul>${feed}</ul>` : `<p class="note">${esc(L.feedEmpty)}</p>`}
      <div class="d-next"><button class="btn small" data-act="go" data-v="3">${esc(D.ui.continueTo)}: ${esc(D.ui.nav[3])}</button></div></section>
  </div>`;
}

function screenDoctor() {
  const Dr = D.doctor;
  const items = queue().map((i) => {
    const t = Dr.items[i.id as keyof typeof Dr.items];
    const f = finding(i.finding);
    const dec = S.decisions[i.id] as keyof typeof Dr.decided | undefined;
    return `<li class="d-item" data-demo="q-${i.id}">
      <div class="h"><h3>${esc(t.title)}</h3>${stateChip(f)}</div>
      <p>${esc(t.why)}</p>
      <button class="d-link" data-act="finding" data-v="${f.id}">${esc(f.gene)} · ${esc(D.results.open)} →</button>
      ${dec
        ? `<div class="d-decided">${esc(Dr.decided[dec])}</div>`
        : `<div class="d-acts"><button class="d-mini pri" data-act="decide" data-v="${i.id}:accept">${esc(Dr.accept)}</button><button class="d-mini" data-act="decide" data-v="${i.id}:test">${esc(Dr.test)}</button><button class="d-mini" data-act="decide" data-v="${i.id}:defer">${esc(Dr.defer)}</button></div>`}
    </li>`;
  }).join('');
  const planItems = queue().filter((i) => S.decisions[i.id] && S.decisions[i.id] !== 'defer');
  const done = planItems.filter((i) => S.plan[i.id]).length;
  const plan = planItems.map((i) => {
    const t = Dr.items[i.id as keyof typeof Dr.items];
    return `<li><label><input type="checkbox" data-act="plan" data-v="${i.id}" ${S.plan[i.id] ? 'checked' : ''}> ${esc(t.plan)}</label></li>`;
  }).join('');
  return `<div class="d-grid wide">
    <section><p class="kicker">${esc(Dr.kicker)}</p><h1>${esc(Dr.title)}</h1><p class="body">${esc(Dr.body)}</p>
      ${items ? `<ul class="d-queue">${items}</ul>` : `<div class="d-empty"><p>${esc(Dr.empty)}</p><button class="btn small" data-act="go" data-v="2">${esc(D.ui.nav[2])}</button></div>`}</section>
    <section class="plate d-feed" data-demo="plan"><p class="label">${esc(Dr.planTitle)}</p>
      ${plan ? `<ul class="d-plan">${plan}</ul><p class="note">${done} / ${planItems.length} ${esc(Dr.planCount)}</p>` : `<p class="note">${esc(Dr.planEmpty)}</p>`}
      <div class="d-stack">
        <button class="btn small" data-act="summary">${esc(Dr.summary)}</button>
        <button class="d-mini" data-act="visit" ${S.visit > 1 ? 'disabled' : ''}>${esc(Dr.visit)}</button>
      </div>
      ${S.visit > 1 ? `<p class="note">${esc(Dr.visitDone)}</p>` : ''}
      <div class="d-next"><button class="btn small" data-act="go" data-v="4">${esc(D.ui.continueTo)}: API</button></div></section>
  </div>`;
}

function screenApi() {
  const A = D.api;
  const f = finding(visible().some((x) => x.id === S.apiFinding) ? S.apiFinding : 't2d');
  const opts = visible().map((x) => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${esc(x.gene)} · ${esc(x.rsid)}</option>`).join('');
  const json = JSON.stringify(gateJson(f), null, 2);
  const buyers = A.buyers.map((b) => `<article><h3>${esc(b.name)}</h3><p>${esc(b.text)}</p></article>`).join('');
  return `<div class="d-grid wide">
    <section><p class="kicker">${esc(A.kicker)}</p><h1>${esc(A.title)}</h1><p class="body">${esc(A.body)}</p>
      <p class="label" style="margin-top:26px">${esc(A.buyersTitle)}</p><div class="models d-buyers">${buyers}</div>
      <p class="note">${esc(A.note)}</p></section>
    <section class="tf-term d-api" data-demo="api">
      <div class="tf-chrome"><i></i><i></i><i></i><span>POST /v1/clinical/gate</span><span class="d-sim">${esc(A.preview)}</span></div>
      <div class="d-apibar"><label>${esc(A.select)} <select data-act="apiSelect">${opts}</select></label><button class="d-mini" data-act="copyJson">${esc(D.ui.copy)}</button></div>
      <pre data-json>${esc(json)}</pre>
    </section>
  </div>`;
}

// While an overlay is open the content behind it is inert, which keeps keyboard focus inside it.
// The tour stays reachable over the evidence panel because it is what opened that panel.
function syncInert() {
  const modalOpen = !modal.hidden;
  const blocked = modalOpen || !!openFinding;
  for (const el of [q('.d-head'), q('.d-banner'), main]) el.inert = blocked;
  guide.inert = modalOpen;
  drawer.inert = modalOpen;
  document.body.classList.toggle('d-drawer-open', !!openFinding);
}

function restoreFocus(el: HTMLElement | null) {
  // The opener may be gone (the tour re-renders its buttons) or may have been the page itself.
  const usable = el && el !== document.body && el.isConnected;
  (usable ? el : q('.d-nav [aria-current]')).focus();
}

function openedModal() {
  modalOpener = document.activeElement as HTMLElement;
  modal.hidden = false;
  syncInert();
  modal.querySelector<HTMLElement>('input, button')?.focus();
}

function renderDrawer() {
  if (!openFinding) {
    drawer.hidden = true;
    drawer.innerHTML = '';
    syncInert();
    if (shownFinding) { shownFinding = null; restoreFocus(drawerOpener); }
    return;
  }
  if (!shownFinding) drawerOpener = document.activeElement as HTMLElement;
  const f = finding(openFinding);
  const t = text(f.id);
  const d = D.detail;
  const freq = (Object.keys(f.freq) as (keyof typeof f.freq)[]).map((k) => {
    const pct = Math.round(f.freq[k] * 1000) / 10;
    return `<div class="fr"><span>${esc(d.pops[k])}</span><i><b style="width:${pct}%"></b></i><em>${num(pct)}${lang === 'ru' ? NB : ''}%</em></div>`;
  }).join('');
  const labs = f.labs.filter((id) => S.labs[id]).map((id) => {
    const l = LABS.find((x) => x.id === id)!;
    const lt = labText(id);
    return `<li>${esc(lt.name)}: <b>${num(labValue(l))}${NB}${esc(lt.unit)}</b> <i class="${labHigh(l) ? 'hi' : 'ok'}">${esc(labHigh(l) ? D.labs.above : D.labs.inRange)}</i></li>`;
  }).join('');
  drawer.hidden = false;
  drawer.innerHTML = `<div class="d-scrim" data-act="closeDrawer"></div>
  <article class="d-panel" role="dialog" aria-modal="${!S.guideOn}" aria-label="${esc(t.q)}">
    <button class="d-x" data-act="closeDrawer" aria-label="${esc(D.ui.close)}">×</button>
    <span class="d-gene">${esc(f.gene)} · ${esc(f.rsid)} · ${esc(f.genotype)}</span>
    <h2>${esc(t.q)}</h2>
    ${stateChip(f)}
    <p class="body">${esc(stateOf(f).meaning)}</p>
    ${t.legacy ? `<p class="d-legacy">${esc(d.legacy)}: <s>${esc(t.legacy)}</s></p>` : ''}
    <div class="d-plain"><p class="label">${esc(d.forPatient)}</p><p>${esc(t.plain)}</p></div>
    <div class="d-dims">
      <div><p class="label">${esc(d.evidence)}</p><ul>${t.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>
      <div><p class="label">${esc(d.transfer)}</p><p>${esc(t.transfer)}</p></div>
      <div><p class="label">${esc(d.risk)}</p><p>${esc(t.risk)}</p></div>
    </div>
    <p class="note">${esc(d.twoNote)}</p>
    <p class="label" style="margin-top:20px">${esc(d.freq)} ${esc(f.altLabel)}</p><div class="d-freq">${freq}</div>
    <dl class="spec" style="margin-top:18px">
      <div><dt>${esc(d.type)}</dt><dd>${esc(D.types[f.questionType as keyof typeof D.types])}</dd></div>
      <div><dt>${esc(d.identity)}</dt><dd class="code">${esc(f.variantId)}</dd></div>
      <div><dt>${esc(d.harmonization)}</dt><dd class="code">${esc(f.harmonization)}</dd></div>
      <div><dt>${esc(d.provenance)}</dt><dd>${esc(d.provenanceBody)}</dd></div>
    </dl>
    <p class="label" style="margin-top:20px">${esc(d.labs)}</p>
    ${labs ? `<ul class="d-inlabs">${labs}</ul>` : `<p class="note">${esc(d.noLabs)}</p>`}
    <p class="label" style="margin-top:20px">${esc(d.limits)}</p>
    <ul class="limits">${t.limits.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="d-plain" style="margin-top:18px"><p class="label">${esc(d.next)}</p><p>${esc(t.next)}</p></div>
    <button class="d-mini" style="margin-top:16px" data-act="toApi" data-v="${f.id}">{ } ${esc(d.asApi)}</button>
  </article>`;
  syncInert();
  if (shownFinding !== openFinding || document.activeElement === document.body) {
    shownFinding = openFinding;
    drawer.querySelector<HTMLElement>('.d-x')!.focus();
  }
}

function showConsent() {
  const c = D.consent;
  modal.innerHTML =`<div class="d-scrim"></div><div class="d-dialog" role="dialog" aria-modal="true" aria-label="${esc(c.title)}">
    <h2>${esc(c.title)}</h2><p class="body">${esc(c.body)}</p>
    <label class="d-check"><input type="checkbox" data-consent> ${esc(c.a)}</label>
    <label class="d-check"><input type="checkbox" data-consent> ${esc(c.b)}</label>
    <div class="d-acts"><button class="btn small" data-act="consentYes" disabled>${esc(c.show)}</button><button class="d-mini" data-act="closeModal">${esc(c.keep)}</button></div>
  </div>`;
  openedModal();
}

function showSummary() {
  const s = D.summary;
  const items = queue().map((i) => {
    const t = D.doctor.items[i.id as keyof typeof D.doctor.items];
    const f = finding(i.finding);
    const dec = S.decisions[i.id] as keyof typeof D.doctor.decided | undefined;
    return `- ${t.title} [${f.gene} ${f.rsid}; ${stateOf(f).label}]${dec ? ` — ${D.doctor.decided[dec]}` : ''}\n  ${t.why}`;
  });
  const labs = LABS.filter((l) => S.labs[l.id]).map((l) => `- ${labText(l.id).name}: ${num(labValue(l))}${NB}${labText(l.id).unit}`);
  const body = [s.header, '', `${s.patient}: ${D.patient.name}, ${D.patient.meta}`, '', `${s.items}:`, ...(items.length ? items : [s.none]), '', `${s.labs}:`, ...(labs.length ? labs : [s.none]), '', s.limits].join('\n');
  modal.innerHTML = `<div class="d-scrim" data-act="closeModal"></div><div class="d-dialog wide" role="dialog" aria-modal="true" aria-label="${esc(D.doctor.summaryTitle)}">
    <h2>${esc(D.doctor.summaryTitle)}</h2><pre class="d-sum" data-sum>${esc(body)}</pre>
    <div class="d-acts"><button class="btn small" data-act="copySum">${esc(D.ui.copy)}</button><button class="d-mini" data-act="print">${esc(D.ui.print)}</button><button class="d-mini" data-act="closeModal">${esc(D.ui.close)}</button></div>
  </div>`;
  openedModal();
}

function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  modal.innerHTML = '';
  syncInert();
  restoreFocus(modalOpener);
}

function renderNav() {
  nav.innerHTML = D.ui.nav.map((n, i) => `<button type="button" data-act="go" data-v="${i}" ${S.screen === i ? 'aria-current="step"' : ''}><b>${i + 1}</b>${esc(n)}</button>`).join('');
}

function render(animate = false) {
  const views = [screenImport, S.imported ? screenResults : requireImport, S.imported ? screenLabs : requireImport, S.imported ? screenDoctor : requireImport, S.imported ? screenApi : requireImport];
  main.innerHTML = views[S.screen]();
  main.classList.toggle('in', animate && !reducedMotion);
  renderNav();
  renderDrawer();
  renderGuide();
  save();
}

// ─── guided tour ─────────────────────────────────────────────────────────────
type GuideAction = () => void;
const finishImport = () => {
  if (!S.imported) scripted = true;
  S.imported = true;
  S.logN = D.importScreen.log.length;
};
// Same transition as the "add all" button, so the tour and the visitor leave identical state.
const addAllLabs = () => {
  for (const l of LABS) if (!S.labs[l.id]) { S.labs[l.id] = true; S.feed.push(l.id); scripted = true; }
};
const ACTIONS: GuideAction[] = [
  () => { openFinding = null; S.screen = 0; },
  () => { openFinding = null; finishImport(); S.screen = 0; },
  () => { openFinding = null; finishImport(); S.screen = 1; },
  () => { finishImport(); S.screen = 1; openFinding = 't2d'; },
  () => { finishImport(); S.screen = 1; openFinding = 'bmi'; },
  // The tour never grants consent: it stops at the same dialog the visitor would use.
  () => { finishImport(); S.screen = 1; openFinding = S.consent ? 'iron' : null; pendingConsent = !S.consent; },
  () => { finishImport(); openFinding = null; S.screen = 2; addAllLabs(); },
  () => { finishImport(); openFinding = null; S.screen = 3; addAllLabs(); },
  () => { finishImport(); openFinding = null; S.screen = 4; },
];
const GUIDE_FOR_SCREEN = [0, 2, 6, 7, 8]; // the tour step that narrates each screen
const SPOT = ['[data-demo=drop],[data-demo=done]', '[data-demo=terminal]', '[data-demo=noscore]', '', '', '', '[data-demo=feed]', '.d-queue', '[data-demo=api]'];

function applyGuide() {
  scripted = false;
  closeModal();
  ACTIONS[S.guideStep]();
  render(true);
  const sel = SPOT[S.guideStep];
  if (sel) document.querySelector(sel)?.classList.add('spot');
  if (pendingConsent) {
    pendingConsent = false;
    stopAuto();
    renderGuide();
    showConsent();
  }
}

function stopAuto() { clearInterval(auto); auto = 0; }

function renderGuide() {
  const g = D.ui.guide;
  if (!S.guideOn) {
    guide.innerHTML = `<button class="d-mini" data-act="guideShow">${esc(g.on)}</button>`;
    guide.classList.add('off');
    return;
  }
  guide.classList.remove('off');
  const n = D.guide.length;
  guide.innerHTML = `<div class="d-gstep">${esc(g.step)} ${S.guideStep + 1} / ${n}</div>
    <p>${esc(D.guide[S.guideStep].text)}</p>
    ${scripted ? `<div class="d-gscript">${esc(g.scripted)}</div>` : ''}
    <div class="d-gbtn">
      <button class="d-mini" data-act="gPrev" ${S.guideStep === 0 ? 'disabled' : ''}>${esc(g.prev)}</button>
      <button class="d-mini pri" data-act="gNext" ${S.guideStep === n - 1 ? 'disabled' : ''}>${esc(g.next)}</button>
      <button class="d-mini" data-act="gPlay">${esc(auto ? g.pause : g.play)}</button>
      <button class="d-mini" data-act="gHide">${esc(g.hide)}</button>
    </div>`;
}

// ─── actions ─────────────────────────────────────────────────────────────────
function runImport() {
  if (importing || S.imported) return;
  importing = true;
  S.logN = 0;
  render();
  const total = D.importScreen.log.length;
  const tick = () => {
    S.logN += 1;
    if (S.logN >= total) { importing = false; S.imported = true; if (S.guideStep === 0) S.guideStep = 1; render(); return; }
    render();
    setTimeout(tick, reducedMotion ? 0 : 340);
  };
  tick();
}

async function copy(el: HTMLElement, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    el.textContent = D.ui.copied;
  } catch { /* clipboard unavailable */ }
}

const handlers: Record<string, (v: string, el: HTMLElement) => void> = {
  go: (v) => {
    stopAuto();
    openFinding = null;
    S.screen = Number(v);
    S.guideStep = S.screen === 0 ? (S.imported ? 1 : 0) : GUIDE_FOR_SCREEN[S.screen];
    render(true);
    scrollTo(0, 0);
  },
  import: () => runImport(),
  finding: (v) => { openFinding = v; renderDrawer(); },
  closeDrawer: () => { openFinding = null; renderDrawer(); },
  consent: () => showConsent(),
  closeModal: () => closeModal(),
  consentYes: () => { S.consent = true; closeModal(); openFinding = 'iron'; render(); },
  lab: (v) => { S.labs[v] = true; S.feed.push(v); render(); },
  labsAll: () => { for (const l of LABS) if (!S.labs[l.id]) { S.labs[l.id] = true; S.feed.push(l.id); } render(); },
  decide: (v) => { const [id, d] = v.split(':'); S.decisions[id] = d; render(); },
  plan: (v) => { S.plan[v] = !S.plan[v]; render(); },
  summary: () => showSummary(),
  visit: () => { S.visit = 2; render(); },
  print: () => window.print(),
  copySum: (_, el) => void copy(el, q('[data-sum]').textContent ?? ''),
  copyJson: (_, el) => void copy(el, q('[data-json]').textContent ?? ''),
  toApi: (v) => { S.apiFinding = v; openFinding = null; S.screen = 4; render(true); scrollTo(0, 0); },
  reset: () => { stopAuto(); importing = false; S = fresh(); openFinding = null; closeModal(); render(true); scrollTo(0, 0); },
  gNext: () => { stopAuto(); if (S.guideStep < D.guide.length - 1) { S.guideStep += 1; applyGuide(); } },
  gPrev: () => { stopAuto(); if (S.guideStep > 0) { S.guideStep -= 1; applyGuide(); } },
  gHide: () => { stopAuto(); S.guideOn = false; render(); },
  guideShow: () => { S.guideOn = true; render(); },
  gPlay: () => {
    if (auto) { stopAuto(); renderGuide(); return; }
    auto = window.setInterval(() => {
      if (S.guideStep >= D.guide.length - 1) { stopAuto(); renderGuide(); return; }
      S.guideStep += 1;
      applyGuide();
    }, 6500);
    renderGuide();
  },
};

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'checkbox') return;
  if ((el as HTMLButtonElement).disabled) return;
  handlers[el.dataset.act!]?.(el.dataset.v ?? '', el);
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  if (el.matches('[data-consent]')) {
    const all = [...modal.querySelectorAll<HTMLInputElement>('[data-consent]')].every((c) => c.checked);
    modal.querySelector<HTMLButtonElement>('[data-act=consentYes]')!.disabled = !all;
  }
  if (el.matches('[data-act=apiSelect]')) { S.apiFinding = el.value; render(); }
  if (el.matches('[data-act=plan]')) handlers.plan(el.dataset.v!, el);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!modal.hidden) closeModal();
  else if (openFinding) { openFinding = null; renderDrawer(); }
});

for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]')) {
  a.addEventListener('click', () => {
    try { localStorage.setItem('vc-lang', a.dataset.langLink!); } catch { /* storage unavailable */ }
  });
}

// Background figure follows the current screen.
const canvas = q<HTMLCanvasElement>('[data-field]');
const scenes = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
try {
  const field = startField({ canvas, sections: scenes, reducedMotion, onScene: () => {} });
  field?.setDriver(() => S.screen);
  document.documentElement.classList.add(field ? 'webgl' : 'no-webgl');
} catch (error) {
  console.warn('Background field disabled:', error);
  document.documentElement.classList.add('no-webgl');
}

render(true);
