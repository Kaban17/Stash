import type { SourcePreset } from '../types/internship.ts';

export const RF_HH_EMPLOYERS: Array<{ id: string; name: string }> = [
  { id: '1740', name: 'Яндекс' },
  { id: '78638', name: 'Т-Банк' },
  { id: '15478', name: 'VK' },
  { id: '3529', name: 'Сбер' },
  { id: '2180', name: 'Ozon' },
  { id: '84585', name: 'Авито' },
  { id: '3776', name: 'МТС' },
  { id: '80', name: 'Альфа-Банк' },
  { id: '1057', name: 'Лаборатория Касперского' },
  { id: '41862', name: 'СКБ Контур' },
  { id: '633069', name: 'Selectel' },
  { id: '87021', name: 'Wildberries' },
];

export const GLOBAL_GREENHOUSE_BOARDS: Array<{ slug: string; company: string }> = [
  { slug: 'stripe', company: 'Stripe' },
  { slug: 'databricks', company: 'Databricks' },
  { slug: 'waymo', company: 'Waymo' },
  { slug: 'imc', company: 'IMC Trading' },
  { slug: 'optiverus', company: 'Optiver' },
  { slug: 'coinbase', company: 'Coinbase' },
  { slug: 'pinterest', company: 'Pinterest' },
  { slug: 'lyft', company: 'Lyft' },
  { slug: 'figma', company: 'Figma' },
  { slug: 'cloudflare', company: 'Cloudflare' },
  { slug: 'datadog', company: 'Datadog' },
  { slug: 'scaleai', company: 'Scale AI' },
  { slug: 'airbnb', company: 'Airbnb' },
  { slug: 'mongodb', company: 'MongoDB' },
  { slug: 'roblox', company: 'Roblox' },
  { slug: 'duolingo', company: 'Duolingo' },
  { slug: 'janestreet', company: 'Jane Street' },
  { slug: 'xai', company: 'xAI' },
  { slug: 'robinhood', company: 'Robinhood' },
  { slug: 'brex', company: 'Brex' },
  { slug: 'anthropic', company: 'Anthropic' },
  { slug: 'adyen', company: 'Adyen' },
];

export const GLOBAL_ASHBY_BOARDS: Array<{ slug: string; company: string }> = [
  { slug: 'openai', company: 'OpenAI' },
  { slug: 'perplexity', company: 'Perplexity' },
  { slug: 'cohere', company: 'Cohere' },
  { slug: 'notion', company: 'Notion' },
  { slug: 'snowflake', company: 'Snowflake' },
  { slug: 'ramp', company: 'Ramp' },
  { slug: 'harvey', company: 'Harvey' },
  { slug: 'elevenlabs', company: 'ElevenLabs' },
  { slug: 'cursor', company: 'Cursor (Anysphere)' },
  { slug: 'linear', company: 'Linear' },
];

export const GLOBAL_LEVER_BOARDS: Array<{ slug: string; company: string }> = [
  { slug: 'palantir', company: 'Palantir' },
  { slug: 'zoox', company: 'Zoox' },
];

export const HNHIRING_TECH_SLUGS: string[] = [
  'python',
  'typescript',
  'go',
  'rust',
  'cplusplus',
  'java',
  'tensorflow',
  'react',
  'node',
];

export const DEFAULT_SOURCE_PRESETS: SourcePreset[] = [
  {
    id: 'habr_career',
    name: 'Хабр Карьера: стажировки (РФ)',
    type: 'habr_career',
    description:
      'Вакансии career.habr.com по грейду «Стажёр (Intern)»: компании РФ, города, вилки и стек.',
    targetUrl: 'https://career.habr.com/vacancies?qid=1&type=all',
    enabled: true,
    companiesCount: 25,
  },
  {
    id: 'habr_junior_backend_ml',
    name: 'Хабр Карьера: Junior Backend и ML (РФ)',
    type: 'habr_junior',
    description:
      'Junior-вакансии (qid=3) по Backend (Python, Go, Java, C++, C#) и Machine Learning / Data Science.',
    targetUrl: 'https://career.habr.com/vacancies?qid=3&type=all',
    enabled: true,
    companiesCount: 30,
  },
  {
    id: 'rf_portals',
    name: 'Карьерные порталы (Яндекс, Т-Банк, VK)',
    type: 'company_portals',
    description:
      'Общие страницы программ Young&&Yandex, Т-Банк Старт и VK Internship.',
    targetUrl: 'https://yandex.ru/yaintern',
    enabled: false,
    companiesCount: 3,
  },
  {
    id: 'hh_top_rf',
    name: 'HeadHunter: топ-12 компаний РФ',
    type: 'hh_employers',
    description:
      'Запросы к api.hh.ru по ID работодателей: Яндекс, Т-Банк, VK, Сбер, Ozon, Авито, МТС, Альфа-Банк, Касперский, Контур, Selectel, Wildberries.',
    targetUrl: 'https://api.hh.ru/vacancies',
    enabled: true,
    companiesCount: 12,
  },
  {
    id: 'bigtech_direct',
    name: 'Amazon и Netflix (прямые порталы)',
    type: 'bigtech_direct',
    description:
      'Порталы Amazon Jobs (amazon.jobs) и Netflix Careers (explore.jobs.netflix.net), Intern и New Grad.',
    targetUrl: 'https://explore.jobs.netflix.net/careers?Teams=Engineering&Teams=Engineering%20Operations&domain=netflix.com&sort_by=relevance',
    enabled: true,
    companiesCount: 2,
  },
  {
    id: 'greenhouse_global',
    name: 'Greenhouse ATS (22 компании)',
    type: 'greenhouse_global',
    description:
      'Доски Greenhouse: Stripe, Databricks, Waymo, Coinbase, Pinterest, Lyft, Figma, Cloudflare, Datadog, Optiver, IMC, Jane Street, xAI, Airbnb, MongoDB и др.',
    targetUrl: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
    enabled: true,
    companiesCount: 22,
  },
  {
    id: 'ashby_global',
    name: 'Ashby ATS (10 компаний)',
    type: 'ashby_global',
    description:
      'Доски Ashby: OpenAI, Perplexity, Cohere, Notion, Snowflake, Ramp, Harvey, ElevenLabs, Cursor, Linear.',
    targetUrl: 'https://api.ashbyhq.com/posting-api/job-board/openai',
    enabled: true,
    companiesCount: 10,
  },
  {
    id: 'lever_global',
    name: 'Lever ATS (Palantir, Zoox)',
    type: 'lever_global',
    description:
      'Доски Lever для Intern и New Grad позиций в Palantir и Zoox.',
    targetUrl: 'https://api.lever.co/v0/postings/palantir?mode=json',
    enabled: true,
    companiesCount: 2,
  },
  {
    id: 'arbeitnow_eu',
    name: 'Arbeitnow (Европа)',
    type: 'arbeitnow_eu',
    description:
      'Европейские IT-вакансии: Working Student, Intern и Junior Backend / ML.',
    targetUrl: 'https://www.arbeitnow.com/api/job-board-api',
    enabled: true,
    companiesCount: 30,
  },
  {
    id: 'hnhiring_tech',
    name: 'HN Hiring (Hacker News)',
    type: 'hnhiring_tech',
    description:
      'Разделы hnhiring.com/technologies/* (Python, TypeScript, Go, Rust, C++, Java, TensorFlow, React, Node): Intern, Junior и New Grad.',
    targetUrl: 'https://hnhiring.com/technologies/python',
    enabled: true,
    companiesCount: 40,
  },
  {
    id: 'amodo_careers',
    name: 'Amodo Design (UK)',
    type: 'amodo_careers',
    description:
      'Вакансии amododesign.com/careers/ (Sheffield, London): Graduate Engineer, AI Verification, Software & Firmware.',
    targetUrl: 'https://amododesign.com/careers/',
    enabled: true,
    companiesCount: 1,
  },
  {
    id: 'hh_general_it',
    name: 'HeadHunter: все IT-стажировки РФ',
    type: 'hh_search',
    description:
      'Поиск стажировок по всей России (area=113) с выделением дедлайнов и вилок.',
    targetUrl: 'https://api.hh.ru/vacancies?text=стажировка&area=113',
    enabled: false,
    companiesCount: 50,
  },
];
