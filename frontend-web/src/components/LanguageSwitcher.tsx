'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`
        flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all duration-200
        rounded-full border shadow-sm cursor-pointer
        ${locale === 'ar' 
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' 
          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}
      `}
      title={locale === 'ar' ? 'Switch to English' : 'تغيير إلى العربية'}
    >
      <Globe size={16} className={locale === 'ar' ? 'text-blue-600' : 'text-emerald-600'} />
      <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
