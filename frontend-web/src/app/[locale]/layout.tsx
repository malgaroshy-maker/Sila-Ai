import {NextIntlClientProvider} from 'next-intl';
import {getMessages, setRequestLocale} from 'next-intl/server';
import {routing} from '@/i18n/routing';
import {notFound} from 'next/navigation';
import { Plus_Jakarta_Sans, Tajawal } from 'next/font/google';
import '../globals.css';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const tajawal = Tajawal({ subsets: ['arabic'], weight: ['400', '500', '700', '800'], variable: '--font-arabic' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className="dark">
      <head>
        <title>AI Recruitment Intelligence</title>
        <meta name="description" content="AI-powered recruitment analysis platform" />
      </head>
      <body className={`min-h-screen bg-[#020617] text-slate-50 antialiased ${plusJakarta.variable} ${tajawal.variable} ${isAr ? 'font-arabic' : 'font-sans'}`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

