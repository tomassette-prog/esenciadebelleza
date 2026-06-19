import type { Metadata } from "next";
import PostForm from "@/components/admin/PostForm";

export const metadata: Metadata = {
  title: "Nuevo Post | Admin",
  robots: { index: false, follow: false },
};

export default function NuevoPostPage() {
  return (
    <div className="max-w-4xl">
      <h1
        className="text-2xl font-light text-neutral-900 mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Nuevo post
      </h1>
      <PostForm />
    </div>
  );
}
