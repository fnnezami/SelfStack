import { NextResponse } from "next/server";
import { getEnabledFloatingModules } from "@/lib/modules";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // If you want to pass service client (to merge registry), create it from env
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const srv = SUPA_URL && SERVICE ? createClient(SUPA_URL, SERVICE) : undefined;

    const mods = await getEnabledFloatingModules();
    const safe = mods.map((m: any) => ({
      id: m.id,
      name: m.name,
      adminPath: m.adminPath,
      installed: !!m.installed,
    }));

    return NextResponse.json({ ok: true, modules: safe });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
