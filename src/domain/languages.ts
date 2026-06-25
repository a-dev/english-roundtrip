export const LANGUAGE_CODES = [
  'pt',
  'es',
  'ar',
  'zh',
  'pl',
  'uk',
  'ru',
  'tr',
  'fr',
  'de',
  'it',
  'ja',
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface TaskLanguageLabels {
  englishLabel: string;
  nativeLabel: string;
}

export interface TaskLanguage extends TaskLanguageLabels {
  code: LanguageCode;
}

export const FALLBACK_TASK_LANGUAGE: LanguageCode = LANGUAGE_CODES[0];

export const TASK_LANGUAGE_LABELS: Readonly<Record<LanguageCode, TaskLanguageLabels>> = {
  ar: { englishLabel: 'Arabic', nativeLabel: 'العربية' },
  zh: { englishLabel: 'Chinese', nativeLabel: '中文' },
  es: { englishLabel: 'Spanish', nativeLabel: 'Español' },
  pt: { englishLabel: 'Portuguese', nativeLabel: 'Português' },
  fr: { englishLabel: 'French', nativeLabel: 'Français' },
  de: { englishLabel: 'German', nativeLabel: 'Deutsch' },
  it: { englishLabel: 'Italian', nativeLabel: 'Italiano' },
  pl: { englishLabel: 'Polish', nativeLabel: 'Polski' },
  uk: { englishLabel: 'Ukrainian', nativeLabel: 'Українська' },
  ru: { englishLabel: 'Russian', nativeLabel: 'Русский' },
  tr: { englishLabel: 'Turkish', nativeLabel: 'Türkçe' },
  ja: { englishLabel: 'Japanese', nativeLabel: '日本語' },
};

export const TASK_LANGUAGES: readonly TaskLanguage[] = LANGUAGE_CODES.map((code) => ({
  code,
  ...TASK_LANGUAGE_LABELS[code],
}));

// Only aliases whose primary subtag is NOT already a supported code belong here.
// Region/script tags like `pt-br` or `zh-hans` need no entry — the primary-subtag
// fallback in `inferTaskLanguage` resolves them to `pt`/`zh` on its own.
const TELEGRAM_LANGUAGE_ALIASES: Readonly<Record<string, LanguageCode>> = {
  ua: 'uk',
};

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function getTaskLanguageLabels(code: LanguageCode): TaskLanguageLabels {
  return TASK_LANGUAGE_LABELS[code];
}

export function getTaskLanguage(code: LanguageCode): TaskLanguage {
  return {
    code,
    ...getTaskLanguageLabels(code),
  };
}

export function inferTaskLanguage(languageCode?: string): LanguageCode {
  const normalized = languageCode?.trim().toLowerCase().replaceAll('_', '-') ?? '';
  if (normalized === '') return FALLBACK_TASK_LANGUAGE;

  const alias = TELEGRAM_LANGUAGE_ALIASES[normalized];
  if (alias !== undefined) return alias;

  const [primarySubtag] = normalized.split('-');
  if (primarySubtag !== undefined && isLanguageCode(primarySubtag)) return primarySubtag;

  return FALLBACK_TASK_LANGUAGE;
}
