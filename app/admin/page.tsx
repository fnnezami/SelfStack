// /app/admin/page.tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import fs from "fs/promises";
import path from "path";
import React from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadBuiltinAdminPages() {
  const adminDir = path.join(process.cwd(), "app", "admin");
  const pages: Array<{ id: string; name: string; href: string }> = [];
  try {
    const entries = await fs.readdir(adminDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const name = e.name;
      // skip the modules folder and settings (settings shown only in sidebar)
      if (name === "modules" || name === "settings") continue;
      const pagePath = path.join(adminDir, name, "page.tsx");
      try {
        const st = await fs.stat(pagePath);
        if (st.isFile())
          pages.push({
            id: name,
            name: name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            href: `/admin/${encodeURIComponent(name)}`,
          });
      } catch { }
    }
  } catch { }
  pages.sort((a, b) => a.name.localeCompare(b.name));
  return pages;
}

type Section = "builtin" | "modules" | "settings";

export default async function AdminHome(props: { searchParams?: any }) {
  const { searchParams } = props;
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // Next may pass searchParams as an async object — await it before use
  const params = (searchParams && typeof (searchParams as any)?.then === "function")
    ? await searchParams
    : searchParams || {};

  // default selected section from query param
  const requested = String(params?.section || "").toLowerCase();
  const activeSection: Section =
    requested === "modules" || requested === "settings" ? (requested as Section) : "builtin";

  if (!SUPA_URL || !SUPA_ANON) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Setup required</h1>
        <p className="text-sm text-gray-600">Missing Supabase envs.</p>
        <Link href="/setup/install" className="underline underline-offset-4 text-sm">
          Open setup
        </Link>
      </div>
    );
  }

  const jar = await cookies();
  const anon = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: { get: (n) => jar.get(n)?.value, set() { }, remove() { } },
  });

  const {
    data: { user },
  } = await anon.auth.getUser();
  const email = user?.email?.toLowerCase() || null;
  if (!email) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Not signed in</h1>
        <p className="text-sm text-gray-600">Sign in to access admin.</p>
      </div>
    );
  }

  // allowlist check (best-effort)
  let allowed = true;
  if (SERVICE) {
    const srv = createClient(SUPA_URL, SERVICE);
    try {
      const { data: settings } = await srv.from("settings").select("admin_allowlist").eq("id", 1).maybeSingle();
      const allow: string[] = Array.isArray(settings?.admin_allowlist)
        ? settings!.admin_allowlist.map((e: any) => String(e || "").toLowerCase())
        : [];
      allowed = allow.length === 0 ? true : allow.includes(email);
    } catch {
      allowed = true;
    }
  }
  if (!allowed) return <div className="mx-auto max-w-md px-4 py-16 text-center">Access denied</div>;

  // load data
  const builtin = await loadBuiltinAdminPages();
  let dynamicModules: Array<{ id: string; name?: string; adminPath?: string; installed?: boolean; enabled?: boolean }> = [];
  try {
    const { listInstalledModules } = await import("@/lib/modules");
    const mods = await listInstalledModules();
    dynamicModules = mods.map((m: any) => ({
      id: m.id,
      name: m.name,
      adminPath: m.adminPath,
      installed: true,
      enabled: m.enabled,
    }));
  } catch {
    dynamicModules = [];
  }

  // UI: left sidebar + right content area
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">

      <div className="flex gap-6">
        {/* Left sidebar */}
        <nav className="w-64 shrink-0">
          <div className="rounded-lg border bg-white">
            <div className="px-4 py-3 border-b">
              <div className="text-sm font-medium">Sections</div>
            </div>

            <div className="p-2">
              <Link
                href={`/admin?section=builtin`}
                className={`block px-3 py-2 rounded-md text-sm ${activeSection === "builtin" ? "bg-slate-100 font-medium" : "hover:bg-slate-50"}`}
              >
                Built-in
                <div className="text-xs text-gray-500 mt-1">{builtin.length} panels</div>
              </Link>

              <Link
                href={`/admin?section=modules`}
                className={`mt-2 block px-3 py-2 rounded-md text-sm ${activeSection === "modules" ? "bg-slate-100 font-medium" : "hover:bg-slate-50"}`}
              >
                Modules
                <div className="text-xs text-gray-500 mt-1">{dynamicModules.length} discovered</div>
              </Link>

              <Link
                href={`/admin?section=settings`}
                className={`mt-2 block px-3 py-2 rounded-md text-sm ${activeSection === "settings" ? "bg-slate-100 font-medium" : "hover:bg-slate-50"}`}
              >
                Settings
                <div className="text-xs text-gray-500 mt-1">Danger zone & site settings</div>
              </Link>
            </div>
          </div>
        </nav>

        {/* Right content */}
        <main className="flex-1">
          <div className="rounded-lg border bg-white p-6 min-h-[420px]">
            {/* header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">
                {activeSection === "builtin" ? "Built-in panels" : activeSection === "modules" ? "Modules" : "Settings"}
              </h2>
              <div className="text-sm text-gray-500">
                {activeSection === "builtin" ? "System panels" : activeSection === "modules" ? "Installed / Available modules" : "Site settings"}
              </div>
            </div>

            {/* content list */}
            {activeSection === "builtin" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Explicit Modules tile so core Modules admin page is always visible */}
                <Link key="modules-panel" href="/admin/modules" className="block rounded-md border p-4 hover:shadow-sm">
                  <div className="text-sm font-medium">Modules</div>
                  <div className="text-xs text-gray-500 mt-2">Install, enable, and configure site modules</div>
                </Link>

                {builtin.length === 0 ? (
                  <div className="rounded-md border p-5 text-sm text-gray-600">No other built-in panels found.</div>
                ) : (
                  builtin.map((p) => (
                    <Link key={p.id} href={p.href} className="block rounded-md border p-4 hover:shadow-sm">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500 mt-2">Built-in admin page</div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {activeSection === "modules" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dynamicModules.length === 0 ? (
                  <div className="rounded-md border p-5 text-sm text-gray-600">No modules found.</div>
                ) : (
                  dynamicModules.map((m) => (
                    <Link
                      key={m.id}
                      href={m.adminPath || `/admin/modules/${encodeURIComponent(m.id)}`}
                      className={`block rounded-md border p-4 hover:shadow-sm ${!m.enabled ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-baseline justify-between">
                        <div className="text-sm font-medium">{m.name || m.id}</div>
                        <div className={`text-xs ${m.installed ? "text-green-600" : "text-gray-500"}`}>{m.installed ? "Installed" : "Available"}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">{m.adminPath ? "Provides admin UI" : "No admin UI"}</div>
                    </Link>
                  ))
                )}
              </div>
            )}

            {activeSection === "settings" && (
              <div>
                <div className="rounded-md border p-4">
                  <div className="text-sm font-medium">Settings</div>
                  <div className="text-xs text-gray-500 mt-2">Open the Settings panel to find reprovision and other site-level controls.</div>
                  <div className="mt-3">
                    <Link href="/admin/settings" className="text-sm underline underline-offset-4">Open Settings</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
