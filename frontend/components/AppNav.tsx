"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { signOut, useSession } from "@/lib/auth-client";

const NAV_ITEMS: { href: string; label: string; icon?: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings/tokens", label: "Tokens", icon: KeyRound },
];

const TAB_ROUTES = ["/dashboard", "/workflows", "/runs", "/analytics"];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return TAB_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  async function handleSignOut() {
    await signOut();
    router.replace("/sign-in");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-8 py-3">
        <Link href="/dashboard" className="hover:opacity-90">
          <Wordmark compact />
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 text-sm ${
                  active ? "text-paper" : "text-fog hover:text-paper"
                }`}
              >
                {Icon && <Icon size={14} />}
                {label}
              </Link>
            );
          })}

          {user && (
            <div className="flex items-center gap-3 border-l border-hairline pl-3">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-7 w-7 shrink-0 rounded-full" />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel-raised text-xs font-medium text-paper">
                  {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                </div>
              )}
              <span className="max-w-[160px] truncate text-sm text-fog">
                {user.name ?? user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong bg-panel-raised px-3 py-1.5 text-sm font-medium text-paper hover:border-fog"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
