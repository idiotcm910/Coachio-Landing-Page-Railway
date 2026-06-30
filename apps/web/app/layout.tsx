import type { Metadata } from 'next';
import { IBM_Plex_Sans, VT323, Inter, Montserrat } from 'next/font/google';
import AuthProviderBridge from './components/auth/AuthProviderBridge';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { ToastProvider } from './components/shared/toast';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
});

const vt323 = VT323({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-vt323',
});

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Coachio Landing',
  description: 'Coachio Landing',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${ibmPlexSans.variable} ${vt323.variable} ${inter.variable} ${montserrat.variable} font-sans antialiased`}>
        <AuthProviderBridge>
          <ThemeProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </ThemeProvider>
        </AuthProviderBridge>
        {gaMeasurementId ? <GoogleAnalytics gaId={gaMeasurementId} /> : null}
      </body>
    </html>
  );
}
