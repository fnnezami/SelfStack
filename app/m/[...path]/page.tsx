import React from "react";
import { notFound } from "next/navigation";

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ModulePublicPage({
  params
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path: segments } = await params;
  const segs = segments ?? [];
  if (!segs || segs.length === 0) return notFound();

  const moduleId = String(segs[0]);
  const slug = segs.slice(1).join("/"); // may be "" when listing

  // resolve manifest
  let manifest: any = null;
  try {
    const { getModuleById } = await import("@/lib/modules");
    const m = await getModuleById(moduleId);
    if (m && m.enabled) manifest = m;
  } catch {
    manifest = null;
  }
  if (!manifest) return notFound();

  // If a slug is present, prefer the module's dedicated post page at modules/<id>/public/[slug]/page
  if (slug) {
    try {
      // import module's public/[slug]/page (server component)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const modPost = await import(`../../../modules/${moduleId}/public/[slug]/page`);
      const PostComp = modPost?.default || modPost?.Page;
      if (PostComp) {
        // pass params in the same shape Next would
        return <PostComp params={{ slug }} manifest={manifest} />;
      }
    } catch {
      // ignore — fall back to API-based rendering below
    }
  }

  // Next: prefer module-provided listing page (modules/<id>/public/page)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import(`../../../modules/${moduleId}/public/page`);
    const PageComp = mod?.default || mod?.Page;
    if (PageComp) {
      // when rendering the module listing we pass slug (may be empty) so module can decide
      return <PageComp params={{ slug }} manifest={manifest} />;
    }
  } catch {
    // ignore import errors -> fallback to server api below
  }

  // Fallback: use module's server/api directly (self-contained)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const modApi = await import(`../../../modules/${moduleId}/server/api`);
    const listPublished = modApi?.listPublishedPosts;
    const getBySlug = modApi?.getPostBySlug;

    if (slug) {
      if (!getBySlug) return notFound();
      const post = await getBySlug(slug);
      if (!post) return notFound();
      return (
        <article className="mx-auto max-w-3xl px-4 py-8 bg-white">
          <h1 className="text-3xl font-semibold">{post.title}</h1>
          {post.created_at && <div className="text-sm text-gray-500 mt-2">{new Date(post.created_at).toLocaleDateString()}</div>}
          <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>
      );
    } else {
      if (!listPublished) return notFound();
      const posts = await listPublished();
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-semibold">{manifest.name}</h1>
          <div className="space-y-6 mt-6">
            {posts.map((p: any) => (
              <article key={p.slug} className="border rounded-md p-4 bg-white">
                <a className="text-lg font-medium" href={`/m/${moduleId}/${encodeURIComponent(p.slug)}`}>
                  {p.title}
                </a>
                {p.summary ? <p className="text-sm text-gray-600 mt-1">{p.summary}</p> : null}
                <div className="text-xs text-gray-500 mt-2">{new Date(p.created_at).toLocaleDateString()}</div>
              </article>
            ))}
            {posts.length === 0 && <div className="text-sm text-gray-500">No published posts.</div>}
          </div>
        </div>
      );
    }
  } catch {
    return notFound();
  }
}