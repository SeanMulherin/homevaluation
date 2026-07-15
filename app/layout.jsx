import '../src/styles.css';

export const metadata = {
  title: 'Housing Market Lab',
  description: 'Interactive single-family home valuation and comparable-property analytics.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f3f5f2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
