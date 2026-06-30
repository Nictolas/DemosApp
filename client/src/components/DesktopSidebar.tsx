import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getVisibleNavItems } from "@/lib/nav-items";
import appIcon from "/icona.png";

export function DesktopSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const navItems = getVisibleNavItems(user?.ruolo);

  const isActive = (path: string) => location.startsWith(path);

  return (
    <aside className="app-desktop-sidebar">
      <div className="app-desktop-sidebar__brand">
        <Link href="/preferiti" className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-100 transition-colors">
          <img src={appIcon} alt="Demos" className="h-10 w-10 rounded-xl" />
          <div className="text-left">
            <p className="text-sm font-bold text-slate-900 leading-tight">DEMOS</p>
            <p className="text-xs text-slate-500 leading-tight">Area personale</p>
          </div>
        </Link>
      </div>

      <nav className="app-desktop-sidebar__nav" aria-label="Navigazione principale">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`app-desktop-sidebar__link ${active ? "app-desktop-sidebar__link--active" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
