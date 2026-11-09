// Measured results, copied from reports/ancestry/AADR_VALIDATION.md, run 20261105-155028-5d7c.
// own = own-region share (weighted model), classic = same for the classic model,
// top = people out of 3 whose top region is correct (weighted model).

export interface RegionResult {
  en: string;
  ru: string;
  europe: boolean;
  own: number;
  classic: number;
  top: 1 | 2 | 3;
}

export const regions: RegionResult[] = [
  { en: 'Italy South & Sicily', ru: 'Южная Италия и Сицилия', europe: true, own: 14, classic: 14, top: 1 },
  { en: 'Balkans', ru: 'Балканы', europe: true, own: 19, classic: 20, top: 2 },
  { en: 'East Africa (Nilotic)', ru: 'Восточная Африка (нилоты)', europe: false, own: 25, classic: 25, top: 2 },
  { en: 'Italy Central', ru: 'Центральная Италия', europe: true, own: 30, classic: 31, top: 3 },
  { en: 'NW Europe & Scandinavia', ru: 'Северо-Западная Европа и Скандинавия', europe: true, own: 32, classic: 35, top: 2 },
  { en: 'Central Asia', ru: 'Центральная Азия', europe: false, own: 33, classic: 33, top: 3 },
  { en: 'Central-East Europe', ru: 'Центрально-Восточная Европа', europe: true, own: 37, classic: 36, top: 1 },
  { en: 'Horn of Africa', ru: 'Африканский Рог', europe: false, own: 38, classic: 36, top: 3 },
  { en: 'Iberia', ru: 'Пиренейский полуостров', europe: true, own: 38, classic: 34, top: 3 },
  { en: 'Finland & Baltic', ru: 'Финляндия и Прибалтика', europe: true, own: 42, classic: 42, top: 1 },
  { en: 'Anatolia & Iran', ru: 'Анатолия и Иран', europe: false, own: 42, classic: 44, top: 3 },
  { en: 'Italy North', ru: 'Северная Италия', europe: true, own: 43, classic: 42, top: 2 },
  { en: 'France', ru: 'Франция', europe: true, own: 44, classic: 44, top: 2 },
  { en: 'East Slavic', ru: 'Восточные славяне', europe: true, own: 51, classic: 51, top: 3 },
  { en: 'Levant', ru: 'Левант', europe: false, own: 60, classic: 59, top: 3 },
  { en: 'Arabia', ru: 'Аравия', europe: false, own: 69, classic: 68, top: 3 },
  { en: 'British Isles', ru: 'Британские острова', europe: true, own: 77, classic: 77, top: 2 },
  { en: 'Sardinia', ru: 'Сардиния', europe: true, own: 79, classic: 78, top: 3 },
  { en: 'Basque', ru: 'Баски', europe: true, own: 82, classic: 80, top: 3 },
  { en: 'Caucasus', ru: 'Кавказ', europe: false, own: 82, classic: 80, top: 3 },
  { en: 'Mesoamerica & Andes (Native American)', ru: 'Мезоамерика и Анды (коренные народы)', europe: false, own: 84, classic: 85, top: 3 },
  { en: 'North Africa', ru: 'Северная Африка', europe: false, own: 86, classic: 86, top: 3 },
  { en: 'East Africa (Bantu)', ru: 'Восточная Африка (банту)', europe: false, own: 87, classic: 86, top: 3 },
  { en: 'Amazonia (Native American)', ru: 'Амазония (коренные народы)', europe: false, own: 89, classic: 88, top: 3 },
  { en: 'South Asia', ru: 'Южная Азия', europe: false, own: 91, classic: 91, top: 3 },
  { en: 'West Africa', ru: 'Западная Африка', europe: false, own: 92, classic: 92, top: 3 },
  { en: 'Siberia', ru: 'Сибирь', europe: false, own: 96, classic: 95, top: 3 },
  { en: 'East Asia', ru: 'Восточная Азия', europe: false, own: 97, classic: 97, top: 3 },
];
