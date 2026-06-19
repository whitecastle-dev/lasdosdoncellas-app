import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex gap-2 items-center font-medium">
      <button 
        onClick={() => changeLanguage('es')} 
        className={i18n.language === 'es' ? 'text-gold underline' : 'text-gray-400 hover:text-white'}
      >
        ES
      </button>
      <span className="text-gray-600">|</span>
      <button 
        onClick={() => changeLanguage('en')} 
        className={i18n.language === 'en' ? 'text-gold underline' : 'text-gray-400 hover:text-white'}
      >
        EN
      </button>
    </div>
  );
}