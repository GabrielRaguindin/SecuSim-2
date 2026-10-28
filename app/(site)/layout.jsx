import SiteFooter from '@/components/shell/SiteFooter';

export default function SiteLayout({ children }) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
