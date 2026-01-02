import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";


import { isServerless } from "@/lib/utils";

export async function POST(req: Request) {
  if (isServerless()) {
    return NextResponse.json(
      { ok: false, error: "Code editing is disabled in serverless production." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { file, code } = body || {};
    if (!file || typeof file !== "string" || typeof code !== "string") {
      return NextResponse.json({ ok: false, error: "file and code required" }, { status: 400 });
    }

    // Security: only allow files with specific extensions
    const ext = path.extname(file).toLowerCase();
    const allowed = [".ts", ".tsx", ".js", ".jsx", ".json", ".sql", ".md", ".txt", ".css", ".scss"];
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { ok: false, error: `File type not allowed. Allowed: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    // Security: resolve absolute path and ensure it's within project
    const absPath = path.resolve(process.cwd(), file.startsWith("/") ? file.slice(1) : file);
    const projectRoot = path.resolve(process.cwd());
    if (!absPath.startsWith(projectRoot + path.sep)) {
      return NextResponse.json({ ok: false, error: "forbidden path" }, { status: 403 });
    }

    // Write file
    await fs.writeFile(absPath, code, "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
