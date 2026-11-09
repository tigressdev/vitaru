// Demo patient Alexey Ivanov. The patient, genotypes and lab values are fictional.
// Catalog figures are real: read from data/consolidated (association, allele_frequency).
import { ruDict } from './demo-ru';
import { assertSameShape, mapStrings, typographRu } from './typograph';

export type StateKey =
  | 'supported_association_risk_not_estimable'
  | 'requires_qualified_clinical_review'
  | 'variant_or_allele_unresolved'
  | 'conflicting_evidence'
  | 'transferability_uncertain'
  | 'insufficient_evidence';

export interface FindingData {
  id: string;
  gene: string;
  rsid: string;
  genotype: string;
  variantId: string;
  questionType: string;
  state: StateKey;
  harmonization: string;
  altLabel: string;
  freq: { eur: number; eas: number; afr: number; sas: number };
  labs: string[];
  sensitive?: boolean;
  api: Record<string, unknown>;
  riskStatus: string;
}

export const FINDINGS: FindingData[] = [
  { id: 't2d', gene: 'TCF7L2', rsid: 'rs7903146', genotype: 'C/T', variantId: 'GRCh38:10:112998590:C:T', questionType: 'single_variant_association', state: 'supported_association_risk_not_estimable', harmonization: 'alt / ref_flipped_major_alt', altLabel: 'T', freq: { eur: 0.292, eas: 0.035, afr: 0.29, sas: 0.318 }, labs: ['hba1c', 'glucose'], riskStatus: 'not_estimable', api: { publications: 38, studies: 47, genome_wide_rows: 57, genome_wide_direction: { increase: 50, decrease: 1, not_reported: 6 }, rows_are_independent_confirmations: false, median_or_study_level: 1.37 } },
  { id: 'statin', gene: 'SLCO1B1', rsid: 'rs4149056', genotype: 'T/C', variantId: 'GRCh38:12:21178615:T:C', questionType: 'pharmacogenomics', state: 'requires_qualified_clinical_review', harmonization: 'alt / ref_flipped_major_alt', altLabel: 'C', freq: { eur: 0.159, eas: 0.124, afr: 0.034, sas: 0.047 }, labs: ['ldl'], riskStatus: 'not_applicable', api: { statin_traits: 6, rows: 12, direction: { reported: 6, not_reported: 6 }, guideline_source: 'pending: CPIC / ClinPGx not ingested' } },
  { id: 'iron', gene: 'HFE', rsid: 'rs1800562', genotype: 'G/A', variantId: 'GRCh38:6:26092913:G:A', questionType: 'mendelian_variant_interpretation', state: 'requires_qualified_clinical_review', harmonization: 'alt / ref_flipped_major_alt', altLabel: 'A', freq: { eur: 0.06, eas: 0, afr: 0.012, sas: 0.001 }, labs: ['ferritin', 'tsat'], sensitive: true, riskStatus: 'not_applicable', api: { classification_source: 'ClinVar', ferritin: { publications: 3, rows: 6 }, transferrin_saturation: { publications: 2, rows: 7 }, serum_iron: { publications: 2, rows: 9 }, orthogonal_confirmation_required: true } },
  { id: 'bmi', gene: 'FTO', rsid: 'rs9939609', genotype: 'T/A', variantId: 'GRCh38:16:53786615:T:A', questionType: 'single_variant_association', state: 'variant_or_allele_unresolved', harmonization: 'ambiguous_palindrome', altLabel: 'A', freq: { eur: 0.41, eas: 0.125, afr: 0.479, sas: 0.286 }, labs: ['bmi'], riskStatus: 'not_assessed', api: { rows: 5, ambiguous_palindrome: 3, unknown_allele: 2, identity_check: 'failed' } },
  { id: 'tg', gene: 'APOA5', rsid: 'rs662799', genotype: 'A/G', variantId: 'GRCh38:11:116792991:G:A', questionType: 'single_variant_association', state: 'conflicting_evidence', harmonization: 'alt / ref_flipped_major_alt', altLabel: 'A', freq: { eur: 0.935, eas: 0.671, afr: 0.878, sas: 0.842 }, labs: ['tg'], riskStatus: 'not_estimable', api: { publications: 13, studies: 15, rows: 17, direction: { increase: 2, decrease: 11, not_reported: 4 }, cohort_independence: 'not established' } },
  { id: 'hcy', gene: 'MTHFR', rsid: 'rs1801133', genotype: 'G/A', variantId: 'GRCh38:1:11796321:G:A', questionType: 'single_variant_association', state: 'transferability_uncertain', harmonization: 'alt / ref_flipped_major_alt', altLabel: 'A', freq: { eur: 0.343, eas: 0.335, afr: 0.119, sas: 0.161 }, labs: ['hcy'], riskStatus: 'not_estimable', api: { publications: 7, rows: 7, direction: { increase: 5, not_reported: 2 }, initial_studies: { european: 4, east_asian: 3 }, russian_recruitment: 0 } },
  { id: 'sport', gene: 'ACTN3', rsid: 'rs1815739', genotype: 'C/T', variantId: 'GRCh38:11:66560624:C:T', questionType: 'exploratory_trait_association', state: 'insufficient_evidence', harmonization: 'ref_flipped_major_alt / unknown_allele', altLabel: 'T', freq: { eur: 0.437, eas: 0.445, afr: 0.177, sas: 0.567 }, labs: [], riskStatus: 'not_assessed', api: { rows: 9, traits: 9, rows_on_athletic_performance: 0 } },
];

export interface LabData {
  id: string; value: number; retest?: number; high: boolean; retestHigh?: boolean; pct: number; finding: string; kind?: 'anthro';
}

export const LABS: LabData[] = [
  { id: 'hba1c', value: 5.8, retest: 5.7, high: false, retestHigh: false, pct: 96, finding: 't2d' },
  { id: 'glucose', value: 5.7, high: false, pct: 93, finding: 't2d' },
  { id: 'ldl', value: 4.4, retest: 3.7, high: true, retestHigh: true, pct: 100, finding: 'statin' },
  { id: 'tg', value: 2.1, retest: 1.8, high: true, retestHigh: true, pct: 100, finding: 'tg' },
  { id: 'ferritin', value: 460, high: true, pct: 100, finding: 'iron' },
  { id: 'tsat', value: 47, high: false, pct: 94, finding: 'iron' },
  { id: 'hcy', value: 13.2, high: false, pct: 88, finding: 'hcy' },
  { id: 'bmi', value: 28.4, retest: 27.6, high: true, retestHigh: true, pct: 100, finding: 'bmi', kind: 'anthro' },
];

export interface QueueData { id: string; finding: string; needsLab?: string; needsConsent?: boolean }

export const QUEUE: QueueData[] = [
  { id: 'statin', finding: 'statin', needsLab: 'ldl' },
  { id: 'iron', finding: 'iron', needsConsent: true },
  { id: 'glycemia', finding: 't2d', needsLab: 'hba1c' },
  { id: 'lipids', finding: 'tg', needsLab: 'tg' },
  { id: 'weight', finding: 'bmi', needsLab: 'bmi' },
];

const en = {
  htmlLang: 'en',
  title: 'VitaCodex demo — fictional patient Alexey Ivanov',
  description: 'Interactive VitaCodex demo with a fictional patient and synthetic data.',
  ui: {
    badge: 'Demo',
    backToSite: 'Back to site',
    banner: 'Demonstration scenario. Alexey Ivanov is fictional; genotypes and lab values are invented. Catalog information is used for illustration only. No clinical mechanism is implemented: states are assigned by hand. Not intended for diagnosis, treatment or prescribing.',
    nav: ['File', 'Results', 'Labs', 'Doctor', 'API'],
    reset: 'Restart',
    close: 'Close',
    open: 'Open',
    continueTo: 'Continue',
    copy: 'Copy',
    copied: 'Copied',
    print: 'Print',
    guide: { on: 'Guided tour', prev: 'Back', next: 'Next', play: 'Auto-play', pause: 'Pause', hide: 'Hide tour', step: 'Step', scripted: 'Simulated by the tour, not by you' },
  },
  patient: { name: 'Alexey Ivanov', meta: '47 years · Moscow · fictional patient', file: 'alexey_ivanov_array_v5.txt', context: 'A cardiologist is considering a statin. Alexey brings a genotype file from a consumer test.' },
  importScreen: {
    kicker: 'Step 1 · The file he already has',
    title: 'From a raw file to checked questions',
    body: 'No new kit. VitaCodex reads the array export and resolves each variant’s identity before it says anything about it.',
    drop: 'Run the demonstration on invented data',
    dropNote: 'This demonstration does not accept real files and uploads nothing.',
    running: 'Simulating...',
    done: 'Open results',
    simulated: 'Simulated processing · no file analyzed',
    log: [
      '$ vita ingest alexey_ivanov_array_v5.txt',
      '> format: genotyping array; example GRCh37 → GRCh38 mapping (not computed)',
      '> genotypes in the invented file: 638,204',
      '> identity: rsID → GRCh38:chrom:pos:REF:ALT',
      '> rs7903146 names 2 variants: C:G, C:T → matched C:T',
      '> example allele and strand alignment against dbSNP',
      '> rs9939609 T/A palindromic: orientation unresolved, flagged',
      '> ClinVar list: 1 potentially significant result, hidden by default',
      '> ancestry: continent only, used as context, never a coefficient',
      '> gate: 7 questions, 6 distinct states, 0 percentages',
      '> provenance attached · limitations attached',
    ],
  },
  results: {
    kicker: 'Step 2 · What can honestly be said',
    title: 'Every question gets its own state',
    noScore: 'There is no total score. One number would hide what the doctor needs to see, so a single score is deliberately not calculated.',
    open: 'See the evidence',
    lockedTitle: 'One potentially significant result is hidden',
    lockedBody: 'The demonstration data include a ClinVar-listed variant. It stays hidden until the patient explicitly chooses to see it.',
    lockedCta: 'Review and choose',
    ancestryTitle: 'Population context',
    ancestryBody: 'Continent: Europe. Region: not reported. In the v2 validation, East Slavic held-out people kept a median of 51% in their own region, so a regional claim is not supported. The population make-up of studies is one factor in judging applicability, does not establish it alone, and never changes an effect size.',
    catalogTitle: 'Russian samples in study metadata',
    catalogBody: '197 of 232,261 catalog studies list recruitment in Russia. The metadata of the variant–trait pairs checked here list none, which does not show a lack of relevance to Russia.',
    hypothesisTitle: 'Model hypotheses',
    hypothesisBody: 'A candidate link from an exploratory model would appear here, labelled as a hypothesis. It can never become evidence or reach the doctor’s packet.',
    hypothesisTag: 'Hypothesis · not evidence',
  },
  detail: {
    type: 'Question type',
    identity: 'Variant identity',
    harmonization: 'Allele harmonization',
    evidence: 'Evidence strength',
    transfer: 'Population transferability',
    risk: 'Individual risk',
    forPatient: 'In plain language',
    limits: 'Limitations',
    next: 'Next step',
    provenance: 'Provenance',
    provenanceBody: 'GWAS Catalog via the consolidated layer · acceptance checks run 20261105-204433-d719 · allele frequency: ALFA',
    freq: 'Frequency of the ALT allele',
    pops: { eur: 'European', eas: 'East Asian', afr: 'African', sas: 'South Asian' },
    legacy: 'Earlier prototype showed',
    labs: 'Lab results beside this question',
    noLabs: 'No lab has been added yet.',
    asApi: 'View as API',
    twoNote: 'Reported separately, never combined.',
  },
  types: {
    single_variant_association: 'Single-variant association',
    pharmacogenomics: 'Pharmacogenomics',
    mendelian_variant_interpretation: 'Mendelian variant interpretation',
    exploratory_trait_association: 'Exploratory trait association',
  },
  states: {
    supported_association_risk_not_estimable: { label: 'Association described, risk not calculated', meaning: 'A statistical association is described in published studies, but no validated model gives this person a probability.' },
    requires_qualified_clinical_review: { label: 'Requires a doctor’s assessment', meaning: 'The question may need a doctor’s assessment. The demonstration does not establish clinical significance automatically and gives no advice.' },
    variant_or_allele_unresolved: { label: 'Allele orientation unresolved', meaning: 'With the available metadata the identity check failed, so no conclusion is formed.' },
    conflicting_evidence: { label: 'Conflicting evidence', meaning: 'Rows disagree in direction. Both sides are shown, and nothing is averaged away.' },
    transferability_uncertain: { label: 'Transferability uncertain', meaning: 'The evidence exists, but whether it applies to this person is not established.' },
    insufficient_evidence: { label: 'Insufficient evidence', meaning: 'Too little independent evidence to say anything.' },
  },
  findings: {
    t2d: {
      q: 'Is there a genetic signal for type 2 diabetes?', short: 'One copy of T. A statistical association is described in studies. No personal percentage.',
      plain: 'Alexey carries one copy of a variant consistently linked to type 2 diabetes across large studies. This describes populations. It does not say how likely he is to develop diabetes.',
      evidence: ['38 publications, 47 studies', '57 genome-wide rows', '50 rows associate the allele with higher risk, 1 with lower, 6 give no direction', 'Catalog rows are not the same as independent confirmations', 'Median study-level OR 1.37'],
      transfer: 'Studied in European, East Asian, South Asian, African American and Hispanic cohorts. T is rare in East Asian samples (3.5%). No Russian recruitment in these studies.',
      risk: 'Not estimable: no validated model, baseline incidence or calibration for a matched population.',
      limits: ['An odds ratio is not a personal risk.', 'Harmonized to T in 52 of 57 genome-wide rows.', 'Consumer array data.'],
      next: 'Show beside HbA1c and fasting glucose. The doctor interprets both.',
      legacy: '“88% model confidence”',
    },
    statin: {
      q: 'Does a variant matter if a statin is prescribed?', short: 'May be relevant when statins are discussed. Needs a doctor’s assessment.',
      plain: 'The variant may be relevant when statin therapy is discussed. That requires current clinical guidelines and a doctor’s assessment.',
      evidence: ['6 statin-response traits, 12 catalog rows', 'Direction reported in 6 rows', 'Clinical guidelines (CPIC, ClinPGx) not loaded yet', 'Diplotype interpretation is not implemented'],
      transfer: 'C is more common in European (15.9%) and East Asian (12.4%) samples than in African (3.4%) or South Asian (4.7%) ones.',
      risk: 'Not applicable: the question is a prescribing guideline, not a probability.',
      limits: ['Guideline-level evidence is required and is not yet loaded.', 'A full diplotype may be needed.', 'Consumer array data.'],
      next: 'Route to the treating doctor if a statin is discussed.',
      legacy: '',
    },
    iron: {
      q: 'Potentially significant result: iron metabolism', short: 'The demonstration data list HFE C282Y. Needs independent confirmation.',
      plain: 'The demonstration data list the variant HFE C282Y. Any clinical conclusion requires independent confirmation of the result and a doctor’s assessment.',
      evidence: ['Ferritin: 3 publications, 6 rows', 'Transferrin saturation: 2 publications, 7 rows', 'Serum iron: 2 publications, 9 rows', 'All with the same direction'],
      transfer: 'A is found mainly in European samples (6.0%) and is rare elsewhere.',
      risk: 'Not applicable: a classification question, not a probability.',
      limits: ['Requires orthogonal laboratory confirmation.', 'Interpretation needs ACMG criteria and gene–disease validity.', 'One copy alone does not establish disease.'],
      next: 'A doctor decides on a confirmatory test and genetic counselling.',
      legacy: '',
    },
    bmi: {
      q: 'Does FTO explain his body weight?', short: 'Allele orientation unresolved. No conclusion is formed.',
      plain: 'T and A are complementary, and the allele frequency is near one half. With the sources and metadata used here the allele orientation is unresolved, so no conclusion is formed.',
      evidence: ['Not assessed: identity failed', '5 rows: 3 ambiguous, 2 with an unknown allele'],
      transfer: 'Not assessed.',
      risk: 'Not assessed.',
      limits: ['Palindromic site.', 'A frequency close to 0.5 (0.41 in Europeans) cannot resolve the orientation.', 'This is a limit of the current metadata and process, not a general impossibility.'],
      next: 'Use measured BMI.',
      legacy: '“OR 1.67”',
    },
    tg: {
      q: 'Is there a signal for triglycerides?', short: 'The catalog shows heterogeneous effect directions. Both sides are shown.',
      plain: 'The catalog shows heterogeneous effect directions. Before combining results, the effect allele, phenotype and independence of samples must be checked.',
      evidence: ['13 publications, 15 studies', '11 rows lower triglycerides on the ALT allele', '2 rows raise them', '4 give no direction', 'This is not a vote among independent studies'],
      transfer: 'Studied mostly in East Asian (8 studies) and European (5) samples. A is less common in East Asian samples (67.1%) than in European ones (93.5%).',
      risk: 'Not estimable.',
      limits: ['Independence of the cohorts has not been established.', 'The discordant rows have not been reviewed.'],
      next: 'Show both sides beside his measured triglycerides.',
      legacy: '',
    },
    hcy: {
      q: 'Does MTHFR apply to him?', short: 'Evidence exists. Applicability to him is not established.',
      plain: 'The variant is linked to homocysteine levels in published studies. The metadata of those studies list no recruitment in Russia, and applicability to this individual was not separately assessed.',
      evidence: ['7 publications, 7 rows', '5 raise homocysteine, 2 give no direction'],
      transfer: 'Initial-stage studies: 4 European (61,561 people), 3 East Asian (16,926). None recruited in Russia.',
      risk: 'Not estimable.',
      limits: ['No LD reference for his population.', 'Transferability has no approved threshold yet.'],
      next: 'Read his measured homocysteine, not the genotype.',
      legacy: '',
    },
    sport: {
      q: 'Does ACTN3 say what sport suits him?', short: 'The catalog version used holds no such records.',
      plain: 'ACTN3 is popular in consumer reports. In the GWAS Catalog version used it has 9 rows for 9 different traits, with no records on athletic performance. This is not a systematic literature review.',
      evidence: ['9 rows, 9 traits, one row each', '0 rows on athletic performance'],
      transfer: 'Not assessed.',
      risk: 'Not assessed.',
      limits: ['GWAS catalog only; candidate-gene literature is not curated here.'],
      next: 'No recommendation is made.',
      legacy: '“Performance cluster”',
    },
  },
  consent: {
    title: 'Do you want to see this result?',
    body: 'This finding may have implications for health and for relatives. It comes from a consumer array and is not a diagnosis.',
    a: 'I understand it needs confirmation by another method.',
    b: 'I want it shared with my doctor, with its evidence and limitations.',
    show: 'Show the finding',
    keep: 'Keep it hidden',
  },
  labs: {
    kicker: 'Step 3 · Clinical Sync',
    title: 'Measurements beside the genetics',
    body: 'A lab value is an observation of the person. It does not “confirm” a population association, so no state above changes. What changes is what the doctor gets to review.',
    pull: 'Add result',
    pullAll: 'Add all results',
    feed: 'Data added',
    feedEmpty: 'Add a result to see its effect.',
    above: 'above the illustrative range',
    inRange: 'within the illustrative range',
    visit2: 'after 12 weeks',
    sections: { lab: 'Laboratory values', anthro: 'Anthropometric measurements' },
    refPrefix: 'illustrative range',
    refNote: 'Values are invented. Illustrative ranges apply to this example only: reference intervals depend on the laboratory, method, age and sex, and nothing here concerns the health of a real person.',
    items: {
      hba1c: { name: 'Glycated haemoglobin (HbA1c)', unit: '%', ref: '< 6.0', note: 'Not a universal diagnostic criterion; interpretation depends on the laboratory method and clinical context.', effect: 'Now shown beside TCF7L2. The state does not change. A follow-up item opens for the doctor.' },
      glucose: { name: 'Fasting blood glucose', unit: 'mmol/L', ref: '3.9–6.1', note: '', effect: 'Added to the same question as an observation.' },
      ldl: { name: 'LDL cholesterol', unit: 'mmol/L', ref: '< 3.0', note: 'The target level depends on cardiovascular risk.', effect: 'If a statin is discussed, SLCO1B1 may be relevant. Item sent to the doctor.' },
      tg: { name: 'Triglycerides', unit: 'mmol/L', ref: '< 1.7', note: '', effect: 'Shown beside the conflicting APOA5 rows. Measurement leads.' },
      ferritin: { name: 'Ferritin', unit: 'µg/L', ref: '30–400', note: 'Reference intervals depend on the laboratory, age and sex.', effect: 'Attached to the hidden HFE finding. Still hidden without consent.' },
      tsat: { name: 'Transferrin saturation', unit: '%', ref: '20–50', note: '', effect: 'Attached to the hidden HFE finding.' },
      hcy: { name: 'Homocysteine', unit: 'µmol/L', ref: '5–15', note: '', effect: 'Read directly, since transferability of MTHFR is uncertain.' },
      bmi: { name: 'Body mass index', unit: 'kg/m²', ref: '< 25', note: '', effect: 'FTO is unresolved, so the measured BMI drives the plan.' },
    },
  },
  doctor: {
    kicker: 'Step 4 · The decision',
    title: 'A summary for the doctor, not a diagnosis',
    body: 'Each item reaches the doctor with its evidence and limitations attached. Decisions here are simulated.',
    empty: 'The queue is empty. Add lab results, or consent to the sensitive finding, and items will arrive.',
    accept: 'Accept for review',
    test: 'Flag need for a confirmatory test',
    defer: 'Defer',
    decided: { accept: 'Accepted for review', test: 'Confirmatory test flagged', defer: 'Deferred' },
    planTitle: 'Plan until the next visit',
    planEmpty: 'Agreed steps will appear here after the doctor decides.',
    planCount: 'done',
    summary: 'Generate demonstration summary',
    summaryTitle: 'Demonstration summary for the doctor',
    visit: 'Next visit (+12 weeks)',
    visitDone: 'New results received. Changes are observed; explaining them is the doctor’s job.',
    items: {
      statin: { title: 'Statin under discussion: consider SLCO1B1', why: 'LDL above the illustrative target, T/C genotype, clinical guidelines not loaded.', plan: 'Discuss statin therapy with the cardiologist' },
      iron: { title: 'HFE C282Y variant: needs independent confirmation', why: 'Patient consented. Array result, ferritin available if added.', plan: 'Confirmatory HFE test and counselling' },
      glycemia: { title: 'Glycaemia follow-up', why: 'HbA1c shown beside a described association; interpretation depends on the criteria.', plan: 'Repeat HbA1c in 12 weeks' },
      lipids: { title: 'Triglycerides above the illustrative range', why: 'Catalog rows conflict; the measurement leads.', plan: 'Repeat the lipid panel' },
      weight: { title: 'Weight plan from measured BMI', why: 'FTO unresolved, so genetics is not used.', plan: 'Agree a weight goal with the doctor' },
    },
  },
  api: {
    kicker: 'Step 5 · How it is sold',
    title: 'Example API response structure',
    body: 'Everything Alexey and his doctor saw is one structured response that a clinic, laboratory or EMR can integrate.',
    note: 'The interface is designed; no server runs yet. This response is generated in your browser.',
    preview: 'API contract preview · no backend request',
    select: 'Question',
    buyersTitle: 'Who integrates it',
    buyers: [
      { name: 'Clinic', text: 'The review packet appears inside the consultation.' },
      { name: 'Laboratory', text: 'Raw results leave with an interpretation attached.' },
      { name: 'EMR vendor', text: 'A documented endpoint instead of a genomic engine.' },
    ],
  },
  summary: { header: 'VitaCodex summary · DEMO · fictional patient', patient: 'Patient', items: 'For review', none: 'No items yet.', labs: 'Lab results', limits: 'Generated from synthetic data. Not a diagnosis.' },
  guide: [
    { text: 'Meet Alexey, a fictional patient. A cardiologist is considering a statin, and he has a raw genotype file he never used.' },
    { text: 'Simulated file processing. Variant identity is resolved first, and one potentially significant result is hidden automatically.' },
    { text: 'No total score. Each question gets its own state, including the ones where the honest answer is “we cannot say”.' },
    { text: 'TCF7L2: the association holds, but no personal percentage is produced. The earlier prototype showed “88% confidence” here.' },
    { text: 'FTO: a palindromic site. The earlier prototype showed an odds ratio. Now the identity check fails and nothing is inferred.' },
    { text: 'The sensitive finding opens only with consent, so the tour stops here: the choice is yours. If you agree, it goes to a doctor with the need for confirmation stated.' },
    { text: 'Lab results arrive. They sit beside the genetics as observations, and they decide what reaches the doctor.' },
    { text: 'In the scenario the doctor reviews the summary and picks a simulated action. New results reopen the cycle.' },
    { text: 'And it is all one API response. That is what a clinic, laboratory or EMR buys.' },
  ],
};

export type DemoDict = typeof en;

assertSameShape(en, ruDict, 'demo');

export const demoDicts: Record<'ru' | 'en', DemoDict> = { ru: mapStrings(ruDict, typographRu), en };
