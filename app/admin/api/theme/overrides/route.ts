export const runtime = "nodejs";

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OVERRIDES_FILE = path.join(ROOT, "app", "theme-overrides.css");
const GLOBALS_FILE = path.join(ROOT, "app", "globals.css");

function getFile(target?: string | null) {
  return target === "globals" ? GLOBALS_FILE : OVERRIDES_FILE;
}

// No auth here — layout is the only gate
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = getFile(searchParams.get("target"));

  try {
    const css = await fs.readFile(file, "utf8");
    return new NextResponse(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  } catch {
    return new NextResponse("", { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
}


import { isServerless } from "@/lib/utils";

export async function POST(req: Request) {
  if (isServerless()) {
    return NextResponse.json({ error: "Theme saving disabled in serverless." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const file = getFile(searchParams.get("target"));

  const css = await req.text();
  await fs.writeFile(file, css, "utf8");
  return NextResponse.json({ ok: true, bytes: Buffer.byteLength(css, "utf8"), file });
}