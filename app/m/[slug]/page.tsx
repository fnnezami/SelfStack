import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getPageModuleBySlug } from "@/lib/modules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ModulePage(props: { params?: any }) {
  // await potentially-thenable params per Next recommendation
  const params = props?.params && typeof (props.params as any)?.then === "function" ? await props.params : props?.params || {};
  const slug = String(params.slug || "");
  const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const srv = SUPA_URL && SERVICE ? createClient(SUPA_URL, SERVICE) : undefined;

  const mod = await getPageModuleBySlug(slug);
  if (!mod) return notFound();

  // Try to render module-provided public UI if present
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const modUI = await import(`../../../modules/${mod.id}/public/page`);
    const PageComp = modUI?.default || modUI?.Page;
    if (PageComp) return <PageComp params={{ slug: "" }} manifest={mod} />;
  } catch {
    // ignore
  }

  // Fallback: import module server/api and render generic list/detail
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const modApi = await import(`../../../modules/${mod.id}/server/api`);
    const listPublished = modApi?.listPublishedPosts;
    const getBySlug = modApi?.getPostBySlug;
    // if slug equals module id (index)
    if (listPublished) {
      const posts = await listPublished();
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold">{mod.name || mod.id}</h1>
          <div className="space-y-6 mt-6">
            {posts.map((p: any) => (
              <article key={p.slug} className="border rounded-md p-4 bg-white">
                <a className="text-lg font-medium" href={`/m/${mod.id}/${encodeURIComponent(p.slug)}`}>{p.title}</a>
              </article>
            ))}
          </div>
        </div>
      );
    }
  } catch {
    // ignore and notFound below
  }

  return notFound();
}
