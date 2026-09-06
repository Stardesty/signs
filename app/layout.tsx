import './globals.css';

export const metadata = {
  title: 'Signs - Novel-Craft Engine',
  description: 'Astronomical synastry engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
