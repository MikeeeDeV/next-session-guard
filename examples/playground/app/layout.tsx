import React from "react";

export const metadata = {
  title: "Next-Session-Guard Playground & SOC Hub",
  description: "Interactive demo and test playground for next-session-guard enterprise session security",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <a href="/" className="font-bold text-white text-base tracking-tight flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
                Next-Session-Guard
              </a>
              <nav className="flex items-center gap-4 text-xs font-semibold">
                <a href="/" className="text-slate-300 hover:text-white transition">
                  User View (Sessions)
                </a>
                <a href="/admin" className="text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  Admin SOC Panel & Simulator
                </a>
              </nav>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Live Playground
            </div>
          </div>
        </header>

        <main className="py-8 px-4">
          {children}
        </main>
      </body>
    </html>
  );
}
