import fs from "fs/promises";
import path from "path";

// Unified Type Definition
export interface ModuleManifest {
  id: string;
  name?: string;
  description?: string;
  kind?: string;
  config?: any;
  enabled?: boolean;
  slug?: string;
  [key: string]: any;
}

const STATIC_MODULES: ModuleManifest[] = [
  {
    "id": "blog-posts",
    "name": "Blog Posts",
    "description": "Blog posts (page module). Self-contained public + admin APIs and admin UI.",
    "kind": "page",
    "adminPath": "/admin/modules/blog-posts",
    "config": {
      "pagePath": "/modules/blog-posts/public"
    },
    "migrations": [
      "migrations/0001_create_blog_posts.sql"
    ],
    "installer": "install.js",
    "uninstaller": "uninstall.js",
    "enabled": true
  },
  {
    "id": "analytics",
    "slug": "analytics",
    "title": "Site Analytics",
    "description": "Tracks and visualizes views for pages, blogs, and projects.",
    "version": "1.0.0",
    "config": {
      "pagePath": "/modules/analytics/public"
    }
  },
  {
    "id": "chat",
    "name": "Floating Chat",
    "kind": "floating",
    "config": { "welcome": "Hi" },
    "migrations": ["migrations/0001_create_chat_messages.sql"],
    "installer": "install.js",
    "uninstaller": "uninstall.js"
  },
  {
    "id": "rest-tester",
    "slug": "rest-tester",
    "title": "REST API Tester",
    "description": "Floating widget for testing REST API endpoints with full customization",
    "version": "1.0.0",
    "config": {
      "widgetPath": "/modules/rest-tester/public/widget.js"
    }
  }
];

// === Core Filesystem Loader ===

/**
 * Lists all modules found in the `modules/` directory with a valid `manifest.json`.
 * This is the SOURCE OF TRUTH for what code is available to run.
 */
export async function listInstalledModules(): Promise<ModuleManifest[]> {
  const modulesRoot = path.join(process.cwd(), "modules");
  try {
    // Ensure dir exists
    await fs.access(modulesRoot).catch(() => null);

    const dirents = await fs.readdir(modulesRoot, { withFileTypes: true });
    // Filter for directories
    const dirs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

    const result: ModuleManifest[] = [];

    for (const id of dirs) {
      const manifestPath = path.join(modulesRoot, id, "manifest.json");
      try {
        const content = await fs.readFile(manifestPath, "utf8");
        const manifest = JSON.parse(content);

        // Ensure critical fields
        manifest.id = manifest.id || id;
        manifest.enabled = manifest.enabled !== false; // Default to true if missing

        result.push(manifest);
      } catch (err) {
        // Skip invalid/missing manifests silently or log if needed
        continue;
      }
    }

    // If fs found nothing (e.g. Vercel weirdness), try fallback
    if (result.length === 0) return STATIC_MODULES;

    return result;
  } catch (err) {
    console.warn("Module discovery failed, using static registry:", err);
    return STATIC_MODULES;
  }
}

/**
 * Gets a specific module by its ID from the filesystem.
 */
export async function getModuleById(id: string): Promise<ModuleManifest | null> {
  if (!id) return null;
  const list = await listInstalledModules();
  return list.find((m) => m.id === id) || null;
}

// === Page Routing Helpers ===

/**
 * Finds a module responsible for a given slug.
 * Prioritizes: Exact Slug Match > ID Match > PagePath Basename Match
 */
export async function getPageModuleBySlug(slug: string): Promise<ModuleManifest | null> {
  const modules = await listInstalledModules();

  for (const m of modules) {
    if (m.enabled === false) continue; // Skip disabled modules

    // 1. Check explicit slug from manifest
    if (m.slug && m.slug === slug) return m;

    // 2. Check Module ID
    if (m.id === slug) return m;

    // 3. Check legacy/config-based Page Path basename
    // e.g. config: { pagePath: "/modules/blog-posts/public" } -> matches slug "blog-posts"
    const rawPagePath = m.config?.pagePath || "";
    if (rawPagePath) {
      const normalized = rawPagePath.replace(/^\/+|\/+$/g, "");
      const base = path.posix.basename(normalized);
      if (base === slug) return m;
    }
  }
  return null;
}

// === Server/DB Utilities (Optional Metadata) ===

/**
 * Helper to get currently enabled "floating" modules (widgets etc).
 */
export async function getEnabledFloatingModules() {
  const modules = await listInstalledModules();
  return modules.filter((m) => m.kind === "floating" && m.enabled !== false);
}

// Backward compatibility / Alias for consumers expecting this function
export const loadModuleManifest = getModuleById;

