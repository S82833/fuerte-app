import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Fuerte · Un paso a la vez', description: 'Demo de acompañamiento a familias en el cuidado diario y la suplementación con hierro.', manifest: '/manifest.webmanifest', icons: { icon: '/assets/logo.png', apple: '/assets/logo.png' }, appleWebApp: { capable: true, title: 'Fuerte', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#faf6f0' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="es"><body><a href="#main" className="skip-link">Ir al contenido</a>{children}</body></html>;}
