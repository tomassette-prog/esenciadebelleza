import { createClient } from "@supabase/supabase-js";

// Cliente con service_role — SOLO para uso en scripts de servidor
// NUNCA exponer en el navegador ni en Server Components públicos
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "❌ Falta variable: NEXT_PUBLIC_SUPABASE_URL\n\nAgrega esta variable en Vercel:\nhttps://vercel.com/tomassette-progs-projects/esenciadebelleza/settings/environment-variables"
    );
  }

  if (!serviceKey) {
    throw new Error(
      "❌ Falta variable: SUPABASE_SERVICE_ROLE_KEY\n\nDebes agregar esta variable en Vercel:\n1. Ve a https://vercel.com/tomassette-progs-projects/esenciadebelleza/settings/environment-variables\n2. Clic en 'Add Environment Variable'\n3. Name: SUPABASE_SERVICE_ROLE_KEY\n4. Value: (copia desde https://app.supabase.com/project/yjanobsfzcwpusynvlun/settings/api)\n5. Environments: Production + Preview\n6. Salva y redeploy"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
