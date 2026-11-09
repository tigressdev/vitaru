import { en, type Dict } from './en';
import { ru } from './ru';
import { assertSameShape, mapStrings, typographRu } from './typograph';

export type Lang = 'ru' | 'en';
export type { Dict };

assertSameShape(en, ru);

export const dictionaries: Record<Lang, Dict> = { ru: mapStrings(ru, typographRu), en };
