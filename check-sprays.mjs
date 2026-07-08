import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supa
  .from("subcategorias")
  .select("*")
  .eq("slug", "sprays");

if (error) {
  console.error("Error:", error.message);
} else {
  console.log("Subcategoría 'sprays':", JSON.stringify(data, null, 2));
  if (data.length === 0) {
    console.log("\n⚠️ NO EXISTE 'sprays' en la tabla subcategorias");
  }
}
