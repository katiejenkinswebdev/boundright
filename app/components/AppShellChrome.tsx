"use client";

import { useState } from "react";
import Link from "next/link";
import { Lockup, Seal, Wordmark } from "@/app/components/brand";

export type NavItem = { href: string; label: string; icon: "dashboard" | "new" | "checks" | "settings" };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/checks/new", label: "New Check", icon: "new" },
  { href: "/checks", label: "Checks", icon: "checks" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

/** Line icons per the brand system: 1.5px stroke, 2px corner radius, Ink. */
function NavIcon({ name }: { name: NavItem["icon"] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="6" height="6" rx="1" />
          <rect x="11.5" y="2.5" width="6" height="6" rx="1" />
          <rect x="2.5" y="11.5" width="6" height="6" rx="1" />
          <rect x="11.5" y="11.5" width="6" height="6" rx="1" />
        </svg>
      );
    case "new":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="15" height="15" rx="2" />
          <path d="M10 6.5v7M6.5 10h7" />
        </svg>
      );
    case "checks":
      return (
        <svg {...common}>
          <path d="M4 4.5h12M4 10h12M4 15.5h12" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 2.5v2.6M10 14.9v2.6M2.5 10h2.6M14.9 10h2.6M4.7 4.7l1.9 1.9M13.4 13.4l1.9 1.9M15.3 4.7l-1.9 1.9M6.6 13.4l-1.9 1.9" />
        </svg>
      );
  }
}

function setSidebarCookie(collapsed: boolean) {
  document.cookie = `br_sidebar=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
}

export function AppShellChrome({
  active,
  awaitingCount = 0,
  initialCollapsed,
  banner,
  sidebarFooter,
  children,
}: {
  active: string;
  awaitingCount?: number;
  initialCollapsed: boolean;
  banner: React.ReactNode;
  sidebarFooter: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    setCollapsed((c) => {
      setSidebarCookie(!c);
      return !c;
    });
  };

  return (
    <div className="flex min-h-screen flex-1">
      <aside
        className={`hidden shrink-0 flex-col border-r border-line bg-card py-6 transition-[width] duration-200 sm:flex ${
          collapsed ? "w-16 px-2" : "w-56 px-4"
        }`}
      >
        <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
          {collapsed ? (
            <Link href="/dashboard" aria-label="BoundRight dashboard">
              <Seal size={26} />
            </Link>
          ) : (
            <Link href="/dashboard">
              <Lockup />
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className={`mb-4 flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink/60 hover:bg-paper hover:text-ink ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {collapsed ? (
              <path d="M7 4.5 12.5 10 7 15.5" />
            ) : (
              <path d="M13 4.5 7.5 10 13 15.5" />
            )}
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>

        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((item) => {
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 rounded px-3 py-2 font-medium ${
                  collapsed ? "justify-center px-0" : ""
                } ${isActive ? "bg-ink text-paper" : "text-ink/80 hover:bg-paper"}`}
              >
                <NavIcon name={item.icon} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.href === "/checks" && awaitingCount > 0 && (
                  <span className={`ml-auto rounded-full px-1.5 font-mono text-xs font-medium ${isActive ? "bg-paper text-caution" : "bg-caution/15 text-caution"}`}>
                    {awaitingCount}
                  </span>
                )}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && <div className="mt-auto space-y-3 px-2">{sidebarFooter}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3 sm:hidden">
          <Link href="/dashboard" className="text-lg">
            <Wordmark />
          </Link>
          <nav className="flex gap-3 text-sm" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={active === item.href ? "font-semibold underline" : ""}
              >
                {item.label.replace("New Check", "New")}
              </Link>
            ))}
          </nav>
        </header>

        {banner}

        <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
