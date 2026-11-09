const NBSP = ' ';
const SHORT = /(^|[\s(«])(а|в|и|к|о|с|у|во|до|за|из|ко|на|не|ни|но|об|от|по|со|для|при|или|как)\s/giu;

export function typographRu(s: string): string {
  return s
    .replace(/ — /g, `${NBSP}— `)
    .replace(/(\d) (?=\d{3}(\D|$))/g, `$1${NBSP}`)
    .replace(/(\d) (%|ГБ|МБ|SNP|нояб\.|ноября|ммоль\/л|мкмоль\/л|мкг\/л|кг\/м²|лет|недель|тыс\.)/g, `$1${NBSP}$2`)
    .replace(SHORT, `$1$2${NBSP}`)
    .replace(SHORT, `$1$2${NBSP}`);
}

export function mapStrings<T>(v: T, f: (s: string) => string): T {
  if (typeof v === 'string') return f(v) as T;
  if (Array.isArray(v)) return v.map((x) => mapStrings(x, f)) as T;
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)])) as T;
  }
  return v;
}

// TypeScript checks keys; this also catches arrays of different lengths, which a type cannot.
export function assertSameShape(a: unknown, b: unknown, path = 'dict'): void {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error(`Translation mismatch at ${path}: ${a.length} vs ${b.length} items`);
    a.forEach((item, i) => assertSameShape(item, b[i], `${path}[${i}]`));
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort().join();
    const kb = Object.keys(b).sort().join();
    if (ka !== kb) throw new Error(`Translation mismatch at ${path}: {${ka}} vs {${kb}}`);
    for (const k of Object.keys(a)) assertSameShape((a as never)[k], (b as never)[k], `${path}.${k}`);
  } else if (typeof a !== typeof b) {
    throw new Error(`Translation mismatch at ${path}`);
  } else if (typeof a === 'string' && !a.trim() !== !(b as string).trim()) {
    throw new Error(`Empty translation at ${path}`);
  }
}
