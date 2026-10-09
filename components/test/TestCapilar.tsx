"use client";

import { useMemo, useState } from "react";

const WHATSAPP_NUM = "34604825305";

interface Opcion {
  texto: string;
  puntos: Partial<Record<"estacional" | "quimica" | "cuero" | "hereditaria", number>>;
}

interface Pregunta {
  titulo: string;
  opciones: Opcion[];
}

const PREGUNTAS: Pregunta[] = [
  {
    titulo: "¿Has notado más pelo de lo normal en el cepillo, la almohada o la ducha?",
    opciones: [
      { texto: "Sí, bastante más de lo normal", puntos: { estacional: 2, quimica: 1, hereditaria: 1 } },
      { texto: "Algo más, pero no mucho", puntos: { estacional: 1, cuero: 1 } },
      { texto: "No, normal", puntos: { hereditaria: 1 } },
    ],
  },
  {
    titulo: "¿Desde cuándo lo notas?",
    opciones: [
      { texto: "Desde hace pocas semanas", puntos: { estacional: 3 } },
      { texto: "Entre 1 y 3 meses", puntos: { estacional: 2, quimica: 1 } },
      { texto: "Más de 3 meses", puntos: { hereditaria: 2, cuero: 1 } },
      { texto: "Toda la vida tengo el pelo fino", puntos: { hereditaria: 3 } },
    ],
  },
  {
    titulo: "¿Qué es lo que más ha cambiado en tu vida estos últimos meses?",
    opciones: [
      { texto: "Estrés, preocupaciones o no dormir bien", puntos: { estacional: 3 } },
      { texto: "Embarazo, postparto o lactancia", puntos: { estacional: 3, hereditaria: 1 } },
      { texto: "Dietas, cambios de alimentación o medicación", puntos: { estacional: 2, hereditaria: 1 } },
      { texto: "Nada especial", puntos: { quimica: 1, cuero: 1, hereditaria: 1 } },
    ],
  },
  {
    titulo: "¿Tu pelo ha sufrido químicos o calor a menudo?",
    opciones: [
      { texto: "Tintes o decoloraciones", puntos: { quimica: 3 } },
      { texto: "Plancha, secador o rizadores casi a diario", puntos: { quimica: 3 } },
      { texto: "Ambas cosas", puntos: { quimica: 4 } },
      { texto: "Casi nada de eso", puntos: { estacional: 1 } },
    ],
  },
  {
    titulo: "¿Cómo notas el cuero cabelludo?",
    opciones: [
      { texto: "Graso, se ensucia rápido", puntos: { cuero: 3 } },
      { texto: "Con caspa o sensación de tirantez", puntos: { cuero: 3 } },
      { texto: "Con picor o irritación", puntos: { cuero: 3, quimica: 1 } },
      { texto: "Normal, sin molestias", puntos: { estacional: 1 } },
    ],
  },
  {
    titulo: "¿Hay antecedentes de caída o poco pelo en tu familia?",
    opciones: [
      { texto: "Sí (padres, abuelos…)", puntos: { hereditaria: 4 } },
      { texto: "No", puntos: { estacional: 1 } },
      { texto: "No lo sé", puntos: {} },
    ],
  },
];

type Perfil = "estacional" | "quimica" | "cuero" | "hereditaria";

interface Diagnostico {
  titulo: string;
  resumen: string;
  plan: string[];
  productos: { nombre: string; detalle: string; url: string }[];
}

const DIAGNOSTICOS: Record<Perfil, Diagnostico> = {
  estacional: {
    titulo: "Caída estacional o por estrés (efluvio telógeno)",
    resumen:
      "Es el tipo de caída más frecuente en otoño y la más reversible: un estrés, un cambio de estación, una dieta o un postparto empujan el pelo a caer de golpe tras unos meses. La buena noticia: con la rutina adecuada, en 6-8 semanas verás el nuevo pelo nacer.",
    plan: [
      "Lava con un champú anticaída suave y masajea el cuero cabelludo 2 minutos (estimula la microcirculación).",
      "Añade ampollas anticaída 2-3 veces por semana durante 8 semanas: es el paso que más se nota.",
      "Cuida el sueño, la alimentación y baja el estrés: el pelo se recupera por dentro y por fuera.",
    ],
    productos: [
      {
        nombre: "Pack Cebolla Anticaída",
        detalle: "Mascarilla Valquer 300 ml + champú Babaria 700 ml por 17,50 €",
        url: "/packs/pack-cebolla-anticaida",
      },
      {
        nombre: "Ampollas Placenta 12x14ml Hipertin",
        detalle: "Tratamiento intensivo anticaída clásico de peluquería",
        url: "/productos/peluqueria/ampollas-y-serums/ampollas-placenta-12x14ml-hipertin",
      },
      {
        nombre: "Champú Bain Preventive Anticaída Keen Strok 300ml",
        detalle: "Lavado diario preventivo, apto para uso frecuente",
        url: "/productos/peluqueria/champus/champu-bain-preventive-anticaida-keen-strok-300ml",
      },
    ],
  },
  quimica: {
    titulo: "Debilidad por químicos o calor (rotura, no caída pura)",
    resumen:
      "Tu pelo no solo cae: se rompe. Tintes, decoloraciones y calor diario debilitan la fibra y el pelo se parte antes de crecer. La solución no es un anticaída cualquiera: es reparar la fibra Y frenar la caída a la vez.",
    plan: [
      "Pausa con la plancha y la decoloración 6-8 semanas (o baja a calor medio con protector térmico siempre).",
      "Repara la fibra con proteínas y reestructurantes cada semana: menos rotura = pelo más lleno al instante.",
      "Alterna ampollas reparadoras con un champú anticaída para trabajar raíz y fibra a la vez.",
    ],
    productos: [
      {
        nombre: "Champú Anticaída Peptide T98 300ml Tahe",
        detalle: "Multipéptidos anticaída + fortalecimiento de la fibra",
        url: "/productos/barberia/champus-barba/champu-anticaida-peptide-t98-300ml-tahe",
      },
      {
        nombre: "Ampolla Flash Ultra Repair 15ml Yunsey",
        detalle: "Reparación intensiva inmediata de la fibra dañada",
        url: "/productos/peluqueria/tratamientos/ampolla-flash-ultra-repair-15-ml-yunsey",
      },
      {
        nombre: "Ampollas K Keratin Regenerador 8x10ml Arual",
        detalle: "Keratina regeneradora para pelo castigado",
        url: "/productos/peluqueria/ampollas/ampollas-k-keratin-regenerador-8x10ml-arual",
      },
    ],
  },
  cuero: {
    titulo: "Cuero cabelludo descontrolado (graso, caspa o picor)",
    resumen:
      "Cuando el cuero cabelludo está inflamado —graso, con caspa o con picor— el folículo no puede sostener el pelo sano y aparece la caída. Primero se equilibra el cuero cabelludo y después se refuerza el pelo: al revés no funciona.",
    plan: [
      "Equilibra el cuero cabelludo con un champú anticaída regulador (2-3 lavados por semana).",
      "Trata el foco con ampollas específicas anticaspa o loción anticaída directamente en raíz.",
      "Evita frotar con uñas ni agresivos: la inflamación es enemiga del pelo nuevo.",
    ],
    productos: [
      {
        nombre: "Champú Anticaída Fitoxil Forte 300ml Tahe",
        detalle: "Regulador y anticaída profesional para cuero cabelludo sensible",
        url: "/productos/barberia/champus-barba/champu-anticaida-fitoxil-forte-300ml-tahe",
      },
      {
        nombre: "Ampollas Kode Kspa Anti Caspa 10x10ml",
        detalle: "Tratamiento específico anticaspa en raíz",
        url: "/productos/peluqueria/ampollas-y-serums/ampollas-kode-kspa-anti-caspa-10-x-10ml",
      },
      {
        nombre: "Ampollas Caída Loción Densidyl 12x10ml Hipertin",
        detalle: "Loción anticaída para cuero cabelludo con tendencia grasa",
        url: "/productos/peluqueria/ampollas-y-serums/ampollas-caida-locion-densidyl-12x10ml-hipertin",
      },
    ],
  },
  hereditaria: {
    titulo: "Tendencia hereditaria o caída crónica (alopecia androgenética)",
    resumen:
      "Cuando la caída es larga en el tiempo y hay antecedentes familiares, suele haber una predisposición que adelanta el afinamiento del pelo. No se cura con un producto suelto: se controla con constancia. Cuanto antes empieces, más pelo conservas — y te recomendamos también valorarlo con un dermatólogo.",
    plan: [
      "Tratamiento intensivo y constante: ampollas de potencia alta 3 veces por semana, sin saltarte semanas.",
      "Champú anticaída de mantenimiento a diario y masaje de raíz para maximizar la absorción.",
      "Consulta con dermatólogo para valorar tratamientos médicos complementarios: nosotros te asesoramos con lo profesional, ellos con lo clínico.",
    ],
    productos: [
      {
        nombre: "Ampollas Aminexil Advanced 42x6ml L'Oréal",
        detalle: "El tratamiento anticaída profesional más potente del catálogo",
        url: "/productos/peluqueria/ampollas-y-serums/ampollas-aminexil-advanced-42x6ml-loreal",
      },
      {
        nombre: "Champú Anticaída Peptide T98 750ml Tahe",
        detalle: "Formato salón para uso constante sin quedarte sin",
        url: "/productos/barberia/champus-barba/champu-anticaida-peptide-t98-750ml-tahe",
      },
      {
        nombre: "Ampollas Anticaída Yunsey 10x10ml",
        detalle: "Loción anticaída de choque para ciclos de 8 semanas",
        url: "/productos/peluqueria/ampollas-y-serums/ampollas-anticaida-yunsey-10-amp-10-ml",
      },
    ],
  },
};

export default function TestCapilar() {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<number[]>([]);
  const [perfilFinal, setPerfilFinal] = useState<Perfil | null>(null);

  const pregunta = PREGUNTAS[paso];

  const progreso = useMemo(
    () => Math.round(((perfilFinal ? PREGUNTAS.length : paso) / PREGUNTAS.length) * 100),
    [paso, perfilFinal]
  );

  function responder(idx: number) {
    const nuevos = [...respuestas, idx];
    setRespuestas(nuevos);
    if (nuevos.length < PREGUNTAS.length) {
      setPaso(paso + 1);
      return;
    }
    const scores: Record<Perfil, number> = { estacional: 0, quimica: 0, cuero: 0, hereditaria: 0 };
    nuevos.forEach((r, i) => {
      const pts = PREGUNTAS[i].opciones[r].puntos;
      (Object.keys(pts) as Perfil[]).forEach((k) => {
        scores[k] += pts[k] ?? 0;
      });
    });
    const perfil = (Object.keys(scores) as Perfil[]).reduce((a, b) =>
      scores[a] >= scores[b] ? a : b
    );
    setPerfilFinal(perfil);
  }

  function reiniciar() {
    setPaso(0);
    setRespuestas([]);
    setPerfilFinal(null);
  }

  const diag = perfilFinal ? DIAGNOSTICOS[perfilFinal] : null;
  const waTexto = diag
    ? encodeURIComponent(
        `Hola, he hecho el Test Anticaída de la web y me ha salido: "${diag.titulo}". Me gustaría que me aconsejarais.`
      )
    : "";

  return (
    <div className="border border-rose-100 bg-rose-50/30 p-6 sm:p-8">
      {/* Progreso */}
      <div className="h-1 bg-neutral-200 mb-6">
        <div
          className="h-1 bg-[#C4857A] transition-all duration-500"
          style={{ width: `${progreso}%` }}
        />
      </div>

      {!diag && (
        <div>
          <p className="text-xs tracking-widest uppercase text-neutral-500 mb-3">
            Pregunta {paso + 1} de {PREGUNTAS.length}
          </p>
          <h2
            className="text-2xl font-light text-neutral-900 mb-6"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {pregunta.titulo}
          </h2>
          <div className="space-y-3">
            {pregunta.opciones.map((op, i) => (
              <button
                key={i}
                type="button"
                onClick={() => responder(i)}
                className="w-full text-left px-5 py-3.5 bg-white border border-neutral-200 text-sm text-neutral-700 hover:border-[#C4857A] hover:bg-white transition-colors"
              >
                {op.texto}
              </button>
            ))}
          </div>
          {paso > 0 && (
            <button
              type="button"
              onClick={() => {
                setPaso(paso - 1);
                setRespuestas(respuestas.slice(0, -1));
              }}
              className="mt-5 text-xs text-neutral-400 hover:text-neutral-700 underline"
            >
              ← Volver a la pregunta anterior
            </button>
          )}
        </div>
      )}

      {diag && (
        <div>
          <p className="text-xs tracking-widest uppercase text-[#C4857A] mb-2">Tu diagnóstico</p>
          <h2
            className="text-3xl font-light text-neutral-900 mb-4"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {diag.titulo}
          </h2>
          <p className="text-neutral-700 mb-6">{diag.resumen}</p>

          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-3">
            Tu plan en 3 pasos
          </h3>
          <ol className="space-y-2 mb-8">
            {diag.plan.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm text-neutral-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#C4857A] text-white text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>

          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-3">
            Tus productos de peluquería profesional
          </h3>
          <div className="space-y-3 mb-8">
            {diag.productos.map((pr) => (
              <a
                key={pr.url}
                href={pr.url}
                className="block px-5 py-4 bg-white border border-neutral-200 hover:border-[#C4857A] transition-colors"
              >
                <p className="text-sm font-medium text-neutral-900">{pr.nombre}</p>
                <p className="text-xs text-neutral-500">{pr.detalle}</p>
              </a>
            ))}
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_NUM}?text=${waTexto}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-6 py-4 bg-[#3D2018] text-white text-sm tracking-widest uppercase hover:bg-[#C4857A] transition-colors"
          >
            Enviar mi diagnóstico por WhatsApp
          </a>
          <p className="text-xs text-neutral-400 text-center mt-2">
            Te confirmamos el tratamiento personalizado y te ayudamos a elegir formatos.
          </p>

          <button
            type="button"
            onClick={reiniciar}
            className="mt-6 w-full text-xs text-neutral-400 hover:text-neutral-700 underline"
          >
            Repetir el test
          </button>
        </div>
      )}
    </div>
  );
}
