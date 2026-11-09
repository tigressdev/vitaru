// Guards the Russian copy against the calques and clinical over-claims removed in the 2026-11-09 audit.
// This checks wording only; it does not replace review by a native-speaking specialist.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (p) => readFileSync(new URL(`../src/content/${p}`, import.meta.url), 'utf8');
const files = { 'ru.ts': read('ru.ts'), 'demo-ru.ts': read('demo-ru.ts'), 'lab.ts': read('lab.ts') };

const banned = [
  [/свидетельств/i, 'evidence: «научные данные»'],
  [/шлюз/i, 'gate: «проверка допустимости вывода»'],
  [/\bсырь|сыр(ой|ые|ого|ых|ому)\b/i, 'raw: «исходные данные»'],
  [/в норме|выше нормы/i, 'no universal reference range'],
  [/переносим/i, 'transferability: «применимость», since «переносимость» also means drug tolerability'],
  [/разведочн/i, 'exploratory: «экспериментальный»'],
  [/гармониз/i, 'harmonization: «согласование аллелей»'],
  [/с учителем/i, 'EM is not supervised learning: «контролируемая модель популяционной смеси»'],
  [/чувствительн/i, 'sensitive: «потенциально значимый результат»'],
  [/является медицинским изделием/i, 'a regulatory status must not be asserted'],
  [/нутрициолог/i, '«специалист по клиническому питанию»'],
  [/потребительск(ий|ого) чип/i, '«микрочиповое генотипирование»'],
];

for (const [name, text] of Object.entries(files)) {
  test(`${name}: no replaced terms`, () => {
    for (const [pattern, why] of banned) {
      const hit = text.match(pattern);
      assert.equal(hit, null, `${name} contains "${hit?.[0]}" (${why})`);
    }
  });
}

test('required disclaimers are present', () => {
  assert.match(files['ru.ts'], /исследовательский прототип/);
  assert.match(files['ru.ts'], /Финансовая модель относится к рынку Бразилии/);
  assert.match(files['demo-ru.ts'], /Клинический механизм не реализован/);
  assert.match(files['demo-ru.ts'], /Имитация обработки · файл не анализируется/);
});
