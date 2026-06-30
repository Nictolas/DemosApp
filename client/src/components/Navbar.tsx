import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getVisibleNavItems } from "@/lib/nav-items";

export default function Navbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const navItems = getVisibleNavItems(user?.ruolo);

  const isActive = (path: string) => location.startsWith(path);

  const getLinkClasses = (path: string) => {
    const baseClasses = "flex flex-col items-center justify-center transition-all duration-200";
    const activeClasses = "text-blue-600 scale-110 font-semibold";
    const inactiveClasses = "text-gray-600 hover:text-blue-500 hover:scale-105";

    return `${baseClasses} ${isActive(path) ? activeClasses : inactiveClasses}`;
  };

  return (
    <nav
      className="bg-white flex justify-center items-center h-24 pt-3 pb-4 select-none px-4"
      style={{
        boxShadow: "0 -1px 8px 0 rgba(0,0,0,0.03)",
        paddingBottom: "calc(1rem + max(env(safe-area-inset-bottom), 56px))",
        borderTop: "none",
      }}
    >
      <div className="flex items-center justify-center gap-10 max-w-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} href={item.path} className={getLinkClasses(item.path)} style={{ marginTop: 0 }}>
              <Icon className={`h-7 w-7 mb-1 ${active ? "drop-shadow-lg text-blue-600" : ""}`} />
              <span className={`text-xs hidden md:block ${active ? "text-blue-600 font-semibold" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
