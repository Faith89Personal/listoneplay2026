import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Listone Play 2026",
  description: "Lista dei giochi da provare in fiera",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5ca040",
};

const themeInitScript = `
(function(){
  try {
    var s = localStorage.getItem('listoneplay2026:theme:v1');
    if (s) {
      var v = JSON.parse(s);
      if (v && typeof v.id === 'string') {
        document.documentElement.setAttribute('data-theme', v.id);
      }
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-theme="green">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
