import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yjanobsfzcwpusynvlun.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSpraysActive() {
  const { data, error } = await supabase
    .from("subcategorias")
    .update({ activa: true })
    .eq("slug", "sprays")
    .eq("categoria", "peluqueria")
    .select();

  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("✓ Updated sprays to activa=true", data);
  }

  process.exit(0);
}

fixSpraysActive();
