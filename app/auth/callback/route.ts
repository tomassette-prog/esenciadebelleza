import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/cuenta";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Fallback: crear perfil si no existe (puede fallar durante registro
      // si el upsert fue antes de confirmar email)
      const admin = createAdminClient();
      const { data: existingProfile } = await admin
        .from("perfiles_usuario")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        const meta = data.user.user_metadata ?? {};
        await admin.from("perfiles_usuario").upsert({
          id: data.user.id,
          nombre_completo: meta.nombre_completo ?? data.user.email ?? "",
          tipo_cliente: meta.tipo_cliente === "b2b" ? "b2b" : "b2c",
          empresa: meta.empresa ?? null,
          nif_cif: meta.nif_cif ?? null,
          telefono: meta.telefono ?? null,
          telefono_contacto: meta.telefono_contacto ?? null,
          tipo_negocio: meta.tipo_negocio ?? null,
          web_instagram: meta.web_instagram ?? null,
          direccion_envio: meta.dir_calle ? { calle: meta.dir_calle, cp: meta.dir_cp, ciudad: meta.dir_ciudad, provincia: meta.dir_provincia } : null,
          direccion_facturacion: meta.fac_calle ? { calle: meta.fac_calle, cp: meta.fac_cp, ciudad: meta.fac_ciudad, provincia: meta.fac_provincia } : null,
          b2b_aprobado: false,
        });
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
