import { useTranslation } from 'react-i18next';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'pt-BR', label: 'PT' },
];

interface LangSwitcherProps {
  className?: string;
}

export function LangSwitcher({ className = '' }: LangSwitcherProps) {
  const { i18n } = useTranslation();

  function setLang(code: string) {
    i18n.changeLanguage(code);
    localStorage.setItem('sd_lang', code);
  }

  const active = i18n.language;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLang(lang.code)}
          className={`font-mono text-[10px] px-1.5 py-0.5 border cursor-pointer tracking-wider transition-colors ${
            active === lang.code
              ? 'border-line-2 text-ink bg-bg-3'
              : 'border-line text-ink-3 bg-bg-2 hover:text-ink'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
