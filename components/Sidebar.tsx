"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, LayoutDashboard, LogOut, Menu, MessagesSquare, Sparkles, Target, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interviews", label: "Interviews", icon: MessagesSquare },
  { href: "/analysis", label: "AI Analysis", icon: Sparkles },
  { href: "/problems", label: "Problem Workspace", icon: Target },
  { href: "/report", label: "Report", icon: FileText },
];

export function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  async function signOut() { await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="px-5 py-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Mosaic Fellowship</div>
        <div className="mt-1 text-lg font-semibold text-white">Customer Intelligence Hub</div>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} onClick={() => setOpen(false)}
              className={cx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", active(href) ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          </li>
        ))}
      </ul>
      <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
        <LogOut className="h-4 w-4" />Sign out
      </button>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">Customer Intelligence Hub</span>
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </div>
      <aside className="hidden w-64 shrink-0 bg-slate-900 lg:sticky lg:top-0 lg:block lg:h-screen">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-slate-900">
            <button className="absolute right-3 top-3 text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
