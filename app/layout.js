import '../styles/tokens.css';
import '../styles/ui.css';
import '../styles/workbench.css';
import '../styles/pages.css';
import SiteNav from '@/components/shell/SiteNav';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'SecuSim', template: '%s | SecuSim' },
  description:
    'SecuSim is a free sandbox for learning how networks are laid out and how security policies protect them. Build topologies and complete timed scenarios.',
  keywords: ['network simulator', 'network topology', 'network security policy', 'learn networking'],
  applicationName: 'SecuSim',
  authors: [{ name: 'Gabriel Raguindin' }],
  openGraph: {
    type: 'website',
    siteName: 'SecuSim',
    title: 'SecuSim',
    description: 'Build the network. Then defend it.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="sx-skip" href="#main">Skip to content</a>
        <SiteNav />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
