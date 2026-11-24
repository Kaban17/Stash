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
  { slug: 'anthropic', company: 'Anthropic' },
  { slug: 'cloudflare', company: 'Cloudflare' },
  { slug: 'scaleai', company: 'Scale AI' },
  { slug: 'coinbase', company: 'Coinbase' },
  { slug: 'airbnb', company: 'Airbnb' },
  { slug: 'duolingo', company: 'Duolingo' },
  { slug: 'mongodb', company: 'MongoDB' },
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
    name: 'Хабр Карьера API — Все стажировки (Intern, РФ)',
    type: 'habr_career',
    description:
      'Живой JSON-парсер career.habr.com по грейду «Стажёр (Intern)»: извлекает компании РФ, города, вилки и стек.',
    targetUrl: 'https://career.habr.com/vacancies?qid=1&type=all',
    enabled: true,
    companiesCount: 25,
  },
  {
    id: 'habr_junior_backend_ml',
    name: 'Хабр Карьера API — Junior Backend & ML (РФ)',
    type: 'habr_junior',
    description:
      'Живой поиск открытых Junior-вакансий (qid=3) по Backend (Python, Go, Java, C++, C#) и Machine Learning / Data Science.',
    targetUrl: 'https://career.habr.com/vacancies?qid=3&type=all',
    enabled: true,
    companiesCount: 30,
  },
  {
    id: 'rf_portals',
    name: 'Карьерные порталы (Яндекс, Т-Банк, VK)',
    type: 'company_portals',
    description:
      'Проверка общих страниц программ Young&&Yandex, Т-Банк Старт и VK Internship (не отдельные вакансии).',
    targetUrl: 'https://yandex.ru/yaintern',
    enabled: false,
    companiesCount: 3,
  },
  {
    id: 'hh_top_rf',
    name: 'HeadHunter API — Топ-12 IT-компаний РФ',
    type: 'hh_employers',
    description:
      'Прямой запрос к api.hh.ru по ID работодателей: Яндекс, Т-Банк, VK, Сбер, Ozon, Авито, МТС, Альфа-Банк, Касперский, Контур, Selectel, Wildberries.',
    targetUrl: 'https://api.hh.ru/vacancies',
    enabled: true,
    companiesCount: 12,
  },
  {
    id: 'greenhouse_global',
    name: 'Greenhouse ATS API — Global BigTech & AI (Зарубеж)',
    type: 'greenhouse_global',
    description:
      'Живой JSON-парсер официальных досок Greenhouse: Stripe, Databricks, Anthropic, Cloudflare, Scale AI, Coinbase, Airbnb, Duolingo, MongoDB, Adyen.',
    targetUrl: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
    enabled: true,
    companiesCount: 10,
  },
  {
    id: 'ashby_global',
    name: 'Ashby ATS API — Frontier AI & High-Growth (Зарубеж)',
    type: 'ashby_global',
    description:
      'Живой JSON-парсер официальных досок Ashby: OpenAI, Perplexity, Cohere, Notion, Snowflake, Ramp, Harvey.',
    targetUrl: 'https://api.ashbyhq.com/posting-api/job-board/openai',
    enabled: true,
    companiesCount: 7,
  },
  {
    id: 'lever_global',
    name: 'Lever ATS API — Palantir & Zoox (Зарубеж)',
    type: 'lever_global',
    description:
      'Живой JSON-парсер официальных досок Lever для Intern и New Grad позиций в Palantir и Zoox.',
    targetUrl: 'https://api.lever.co/v0/postings/palantir?mode=json',
    enabled: true,
    companiesCount: 2,
  },
  {
    id: 'arbeitnow_eu',
    name: 'Arbeitnow API — Стажировки и Junior в Европе (EU)',
    type: 'arbeitnow_eu',
    description:
      'Живой JSON-парсер европейских IT-вакансий (Working Student, Intern, Junior Backend & ML в Германии и странах ЕС).',
    targetUrl: 'https://www.arbeitnow.com/api/job-board-api',
    enabled: true,
    companiesCount: 30,
  },
  {
    id: 'hnhiring_tech',
    name: 'HN Hiring — Вакансии по технологиям (Hacker News)',
    type: 'hnhiring_tech',
    description:
      'Живой парсер разделов hnhiring.com/technologies/* (Python, TypeScript, Go, Rust, C++, Java, TensorFlow, React, Node) — Intern, Junior и New Grad позиции.',
    targetUrl: 'https://hnhiring.com/technologies/python',
    enabled: true,
    companiesCount: 40,
  },
  {
    id: 'amodo_careers',
    name: 'Amodo Design — Карьерная страница (UK)',
    type: 'amodo_careers',
    description:
      'Живой парсер открытых позиций amododesign.com/careers/ (Sheffield / London): Graduate Software/Electronics/Mechanical Engineer, AI Verification, Software & Firmware.',
    targetUrl: 'https://amododesign.com/careers/',
    enabled: true,
    companiesCount: 1,
  },
  {
    id: 'hh_general_it',
    name: 'HeadHunter API — Все IT-стажировки (РФ)',
    type: 'hh_search',
    description:
      'Поиск свежих стажировок по всей России (area=113) с автоматическим выделением дедлайнов и вилок.',
    targetUrl: 'https://api.hh.ru/vacancies?text=стажировка&area=113',
    enabled: false,
    companiesCount: 50,
  },
];
