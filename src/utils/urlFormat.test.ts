import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDirectLinkLabel, isDirectVacancyUrl } from './urlFormat';

test('formatDirectLinkLabel formats Habr Career and Yandex direct links cleanly', () => {
  assert.equal(
    formatDirectLinkLabel('https://career.habr.com/vacancies/1000170506'),
    'career.habr.com/…/1000170506'
  );
  assert.equal(
    formatDirectLinkLabel('https://yandex.ru/yaintern/backend'),
    'yandex.ru/yaintern/backend'
  );
  assert.equal(
    formatDirectLinkLabel('https://www.start.avito.ru/'),
    'start.avito.ru'
  );
});

test('formatDirectLinkLabel preserves ATS gh_jid and shortens long Lever UUIDs', () => {
  const stripeLabel = formatDirectLinkLabel(
    'https://stripe.com/jobs/search?gh_jid=8333122',
    40
  );
  assert.equal(stripeLabel, 'stripe.com/jobs/search?gh_jid=8333122');

  const leverLabel = formatDirectLinkLabel(
    'https://jobs.lever.co/palantir/cadc0eb2-2703-43e4-8e4f-41edf5b071c6',
    36
  );
  assert.equal(leverLabel, 'jobs.lever.co/…/cadc0eb2…');
});

test('formatDirectLinkLabel handles empty and malformed URLs safely', () => {
  assert.equal(formatDirectLinkLabel(''), '—');
  assert.equal(formatDirectLinkLabel('not-a-valid-url'), 'not-a-valid-url');
});

test('isDirectVacancyUrl identifies direct vacancy links vs generic career portals', () => {
  assert.equal(isDirectVacancyUrl('https://career.habr.com/vacancies/1000170506'), true);
  assert.equal(isDirectVacancyUrl('https://stripe.com/jobs/search?gh_jid=8333122'), true);
  assert.equal(
    isDirectVacancyUrl('https://jobs.lever.co/palantir/cadc0eb2-2703-43e4-8e4f-41edf5b071c6'),
    true
  );
  assert.equal(isDirectVacancyUrl('https://yandex.ru/yaintern/backend'), true);
  assert.equal(isDirectVacancyUrl('https://amododesign.com/career/graduate-software-engineer/'), true);
  assert.equal(isDirectVacancyUrl('https://explore.jobs.netflix.net/careers/job/790318904468'), true);
  assert.equal(
    isDirectVacancyUrl('https://www.amazon.jobs/en/jobs/10418355/2027-software-dev-engineer-intern'),
    true
  );
  assert.equal(isDirectVacancyUrl('https://www.ycombinator.com/companies/mixrank/jobs/Fnwsojk-j'), true);
  assert.equal(isDirectVacancyUrl('https://rabota.sber.ru/'), false);
  assert.equal(isDirectVacancyUrl('https://careers.yadro.com/'), false);
});
