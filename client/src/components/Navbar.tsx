import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getVisibleNavItems } from "@/lib/nav-items";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const navItems = getVisibleNavItems(user?.ruolo);

  const isActive = (path: string) => location.startsWith(path);

  const getLinkClasses = (path: string) => {
    const baseClasses =
      "flex flex-col items-center justify-center min-w-0 flex-1 max-w-[3.5rem] transition-all duration-200";
    const activeClasses = "text-blue-600 scale-110 font-semibold";
    const inactiveClasses = "text-gray-600 hover:text-blue-500 hover:scale-105";

    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav className="app-bottom-nav bg-white flex justify-center items-center select-none px-2 pt-2">
      <div className="flex w-full max-w-lg items-center justify-between gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path} className={getLinkClasses(item.path)}>
              <Icon className={`h-6 w-6 sm:h-7 sm:w-7 mb-0.5 ${active ? "text-blue-600" : ""}`} />
              <span
                className={`text-[10px] sm:text-xs leading-tight truncate max-w-full ${
                  active ? "text-blue-600 font-semibold" : ""
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
