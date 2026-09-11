import { useEffect, useState } from "react";
import { applyLanguage, readStoredLang, storeLang, type Lang } from "@/lib/translate";

/**
 * EN / 中文 switch. Mounts the runtime translation layer on first render and
 * persists the choice in localStorage.
 */
export function LanguageToggle({
  className = "",
  style,
  onSelect,
}: {
  className?: string;
  style?: React.CSSProperties;
  onSelect?: () => void;
}) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const initial = readStoredLang();
    setLang(initial);
    if (initial !== "en") applyLanguage(initial);
    return () => applyLanguage("en");
  }, []);

  const select = (next: Lang) => {
    if (next === lang) {
      onSelect?.();
      return;
    }
    setLang(next);
    storeLang(next);
    applyLanguage(next);
    onSelect?.();
  };

  return (
    <div className={`lang-toggle ${className}`} style={style} role="group" aria-label="Language / 语言" data-no-translate>
      <button
        type="button"
        className={`lang-toggle-option ${lang === "en" ? "is-active" : ""}`}
        onClick={() => select("en")}
        aria-pressed={lang === "en"}
        title="English"
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-toggle-option ${lang === "zh" ? "is-active" : ""}`}
        onClick={() => select("zh")}
        aria-pressed={lang === "zh"}
        title="简体中文"
      >
        中文
      </button>
    </div>
  );
}

export default LanguageToggle;
