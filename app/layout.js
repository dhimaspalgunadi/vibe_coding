import './globals.css';

export const metadata = {
  title: 'Papan Status Tim',
  description: 'Lihat status kerja tim saat ini, langsung dari HP.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
