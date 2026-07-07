"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, History, LayoutDashboard, LayoutGrid } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workflows", label: "Workflows", icon: LayoutGrid },
  { href: "/runs", label: "Runs", icon: History },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b border-hairline bg-ink-raised/40">
        <nav className="max-w-[1080px] mx-auto px-8 flex items-center gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  active ? "text-paper" : "text-fog hover:text-paper-dim"
                }`}
              >
                <Icon size={14} className={active ? "text-amber" : "text-fog-dim"} />
                {label}
                <span
                  className={`absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-opacity ${
                    active ? "bg-amber opacity-100" : "opacity-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
