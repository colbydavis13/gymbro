import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, Calendar, Settings } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-background">
      <div className="w-full max-w-[400px] bg-background flex flex-col relative shadow-sm">
        <header className="px-6 pt-6 pb-4 bg-background z-10" role="banner">
          <h1 className="text-center font-bold text-xl text-primary mb-2 tracking-tight">Gym Bro</h1>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        </header>

        <main className="flex-1 px-6 pb-24 overflow-y-auto" role="main">
          {children}
        </main>

        <footer className="fixed bottom-16 w-full max-w-[400px] text-center pb-2 text-[10px] text-muted-foreground z-10">
          Built by Colby Davis
        </footer>

        <nav className="fixed bottom-0 w-full max-w-[400px] bg-[#F1F8F4] border-t border-border flex justify-around items-center h-16 px-4 pb-safe z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]" role="navigation" aria-label="Bottom Navigation">
          <Link href="/" className="flex flex-col items-center justify-center w-16 h-full gap-1" aria-label="Attendance">
            <Home className={`w-6 h-6 transition-colors ${location === "/" ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium transition-colors ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>Today</span>
          </Link>
          <Link href="/schedule" className="flex flex-col items-center justify-center w-16 h-full gap-1" aria-label="Schedule">
            <Calendar className={`w-6 h-6 transition-colors ${location === "/schedule" ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium transition-colors ${location === "/schedule" ? "text-primary" : "text-muted-foreground"}`}>Schedule</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center justify-center w-16 h-full gap-1" aria-label="Settings">
            <Settings className={`w-6 h-6 transition-colors ${location === "/settings" ? "text-primary" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium transition-colors ${location === "/settings" ? "text-primary" : "text-muted-foreground"}`}>Settings</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}