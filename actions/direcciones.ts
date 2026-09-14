"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function actualizarDirecciones(
  formData: FormData
): Promise<{ error: string; success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado.", success: false };

  // Dirección de envío
  const envio = {
    nombre:     (formData.get("envio_nombre") as string)?.trim() || "",
    apellidos:  (formData.get("envio_apellidos") as string)?.trim() || "",
    direccion:  (formData.get("envio_direccion") as string)?.trim() || "",
    cp:         (formData.get("envio_cp") as string)?.trim() || "",
    ciudad:     (formData.get("envio_ciudad") as string)?.trim() || "",
    provincia:  (formData.get("envio_provincia") as string)?.trim() || "",
    telefono:   (formData.get("envio_telefono") as string)?.trim() || "",
  };

  // Dirección de facturación
  const mismaDireccion = formData.get("misma_direccion") === "on";
  const facturacion = mismaDireccion
    ? null
    : {
        nombre:     (formData.get("fac_nombre") as string)?.trim() || "",
        apellidos:  (formData.get("fac_apellidos") as string)?.trim() || "",
        direccion:  (formData.get("fac_direccion") as string)?.trim() || "",
        cp:         (formData.get("fac_cp") as string)?.trim() || "",
        ciudad:     (formData.get("fac_ciudad") as string)?.trim() || "",
        provincia:  (formData.get("fac_provincia") as string)?.trim() || "",
        nif_cif:    (formData.get("fac_nif_cif") as string)?.trim() || "",
      };

  // Validaciones mínimas
  if (!envio.direccion || !envio.cp || !envio.ciudad || !envio.provincia) {
    return { error: "La dirección de envío debe incluir calle, CP, ciudad y provincia.", success: false };
  }

  const { error } = await supabase
    .from("perfiles_usuario")
    .update({
      direccion_envio: envio,
      direccion_facturacion: facturacion,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "No se pudieron guardar las direcciones. Inténtalo de nuevo.", success: false };
  }

  revalidatePath("/cuenta/direcciones");
  return { error: "", success: true };
}
