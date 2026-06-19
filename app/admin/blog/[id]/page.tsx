import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PostForm from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar Post | Admin",
  robots: { index: false, follow: false },
};

export default async function EditarPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) notFound();

  return (
    <div className="max-w-4xl">
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Editar post
      </h1>
      <p className="text-sm text-neutral-400 mb-8">/blog/{post.slug}</p>
      <PostForm post={post} />
    </div>
  );
}
