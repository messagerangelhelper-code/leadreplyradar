import './globals.css';

export const metadata = {
  title: 'LeadReplyRadar',
  description: 'Never miss an important email that needs a quick reply.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B1220',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
