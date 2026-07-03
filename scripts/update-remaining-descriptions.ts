import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
  {
    slug: "champu-novon-barba-barbe-club-250ml",
    descripcion: "Champú para el cuidado de la barba. Champú especialmente formulado para hidratar y limpiar la barba. Con extractos de Aloe Vera y Pro Vitamina B5, que ayudan a alisar y equilibrar la piel. Hace más fácil el peinado de la barba."
  },
  {
    slug: "champu-neutro-pina-coco-yunsey-5-litros",
    descripcion: "Champú exclusivo para uso profesional. Proporciona una gran frescura dejando el cabello suave y ligero. Es muy eficaz, ofrece una limpieza completa del cabello. Su intenso aroma a piña-coco proporciona una sensación placentera durante el lavado del cabello, aportando fortaleza y brillo. Champú de uso profesional con exquisitas fragancias naturales. MODO DE EMPLEO: Aplicar sobre el cabello húmedo y masajear suavemente durante 5-7 minutos. Aclarar."
  }
];

async function update() {
  for (const item of updates) {
    const { data: producto } = await supabase
      .from("productos_padre")
      .select("id, nombre")
      .eq("slug", item.slug)
      .single();

    if (!producto) {
      console.log(`❌ No encontrado: ${item.slug}`);
      continue;
    }

    const { error } = await supabase
      .from("productos_padre")
      .update({ descripcion_general: item.descripcion })
      .eq("id", producto.id);

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✅ Actualizado: ${producto.nombre}`);
    }
  }
}

update().catch(console.error);
