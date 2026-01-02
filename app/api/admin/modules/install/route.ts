import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";
import { loadModuleManifest } from "@/lib/modules";
import { spawn, spawnSync } from "child_process";

export const runtime = "nodejs";

function parseCookies(cookieHeader: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.split("=");
    if (!k) continue;
    map[k.trim()] = decodeURIComponent((rest || []).join("=").trim());
  }
  return map;
}

// keep your existing verifyAdmin implementation (unchanged)
async function verifyAdmin(req: Request) {
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!SUPA_URL || !SUPA_ANON || !SERVICE) throw new Error("Supabase envs not configured");

  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const server = createServerClient(SUPA_URL, SUPA_ANON, {
    cookies: {
      get: (n: string) => cookies[n],
      set: () => { },
      remove: () => { },
    },
  });

  const { data: { user } } = await server.auth.getUser();
  const email = user?.email?.toLowerCase() || null;
  if (!email) throw new Error("Not authenticated");

  const srv = createClient(SUPA_URL, SERVICE);
  const { data: settings, error } = await srv
    .from("settings")
    .select("admin_allowlist")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  const allow: string[] = Array.isArray(settings?.admin_allowlist)
    ? settings!.admin_allowlist.map((e: string) => (e || "").toLowerCase())
    : [];

  if (allow.length === 0) {
    return true;
  }

  return allow.includes(email);
}


import { isServerless } from "@/lib/utils";

export async function POST(req: Request) {
  if (isServerless()) {
    return NextResponse.json(
      { error: "Module installation is not available in serverless mode. Please install locally and commit." },
      { status: 403 }
    );
  }

  try {
    const ok = await verifyAdmin(req);
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const body = await req.json();
    const moduleId = body?.moduleId;
    if (!moduleId) return NextResponse.json({ error: "missing moduleId" }, { status: 400 });

    const manifest = await loadModuleManifest(moduleId);
    if (!manifest) return NextResponse.json({ error: "module not found" }, { status: 404 });

    // === RUN MODULE INSTALLER SCRIPT (MANDATORY) ===
    const moduleDir = path.join(process.cwd(), "modules", manifest.id);
    let installerName = (manifest && (manifest.installer || manifest.installerFile)) || "install.js";
    const installerPath = path.join(moduleDir, installerName);
    const installerResult: any = { ran: false };

    if (!fs.existsSync(installerPath)) {
      // fallback: common alternatives
      const alts = ["install.js", "install.mjs", "install.ts", "install.tsx"];
      for (const a of alts) {
        const p = path.join(moduleDir, a);
        if (fs.existsSync(p)) {
          installerName = a;
          break;
        }
      }
    }

    const finalInstallerPath = path.join(moduleDir, installerName);
    if (fs.existsSync(finalInstallerPath)) {
      installerResult.ran = true;
      try {
        // spawn a separate Node process to execute the module installer
        const ext = path.extname(finalInstallerPath).toLowerCase();
        let args: string[] = [];

        if (ext === ".ts" || ext === ".tsx") {
          try {
            require.resolve("ts-node/register");
            args = ["-r", "ts-node/register", finalInstallerPath];
          } catch (e) {
            throw new Error("TypeScript installer detected but ts-node not installed.");
          }
        } else {
          args = [finalInstallerPath];
        }

        const proc = spawnSync(process.execPath, args, {
          cwd: moduleDir,
          env: Object.assign({}, process.env),
          encoding: "utf8",
          timeout: 5 * 60 * 1000,
          maxBuffer: 20 * 1024 * 1024,
        });

        installerResult.proc = {
          status: proc.status,
          stdout: proc.stdout ? String(proc.stdout).slice(0, 200000) : "",
          stderr: proc.stderr ? String(proc.stderr).slice(0, 200000) : "",
        };

        if (proc.status !== 0) {
          throw new Error(`installer exited with status ${proc.status}. stderr: ${installerResult.proc.stderr}`);
        }
      } catch (err: any) {
        return NextResponse.json({ error: String(err?.message || err), installer: installerResult }, { status: 500 });
      }
    } else {
      installerResult.ran = false;
    }
    // === END RUN INSTALLER ===

    // === UPDATE MANIFEST (ENABLE) ===
    try {
      const manifestPath = path.join(moduleDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, "utf8");
        const json = JSON.parse(raw);
        json.enabled = true;
        fs.writeFileSync(manifestPath, JSON.stringify(json, null, 2));
      }
    } catch (e) {
      console.error("Failed to update manifest.json", e);
    }

    // === TRIGGER REBUILD (BACKGROUND) ===
    const rebuildCmd = process.env.REBUILD_COMMAND;
    if (rebuildCmd) {
      console.log("Triggering rebuild command:", rebuildCmd);
      // Execute in background, don't wait? Or wait to confirm start?
      // We'll spawn it detached or just synchronous if simple.
      // For reliability, usually synchronous spawn (shell) is better if we want to ensure it started,
      // but it might kill the server.
      // Let's assume the user uses a script that handles restarting.
      try {
        const parts = rebuildCmd.split(" ");
        const cmd = parts[0];
        const args = parts.slice(1);
        spawn(cmd, args, {
          detached: true,
          stdio: "ignore",
          shell: true
        }).unref();
      } catch (e) {
        console.error("Failed to spawn rebuild command", e);
      }
    } else {
      console.log("No REBUILD_COMMAND configured. Skipping rebuild.");
    }

    return NextResponse.json({ ok: true, installer: installerResult, rebuildTriggered: !!rebuildCmd });

  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}