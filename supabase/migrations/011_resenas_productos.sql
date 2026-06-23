-- ─── Tabla de reseñas de productos ─────────────────────────────────────────
create table if not exists public.resenas (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references public.productos_padre(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  autor_nombre  text not null,
  valoracion    smallint not null check (valoracion between 1 and 5),
  titulo        text,
  cuerpo        text not null,
  aprobada      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Índices
create index if not exists resenas_producto_id_idx on public.resenas(producto_id);
create index if not exists resenas_aprobada_idx    on public.resenas(aprobada);

-- RLS
alter table public.resenas enable row level security;

-- Cualquiera puede leer las reseñas aprobadas
create policy "Leer reseñas aprobadas"
  on public.resenas for select
  using (aprobada = true);

-- Usuario autenticado puede insertar su propia reseña
create policy "Insertar propia reseña"
  on public.resenas for insert
  with check (auth.uid() = user_id);

-- Admin puede hacer todo (via service role — sin policy necesaria)

-- Vista materializada con aggregate por producto (actualizable desde server)
create or replace view public.resenas_aggregate as
select
  producto_id,
  count(*)::int                    as total_resenas,
  round(avg(valoracion)::numeric, 1) as valoracion_media
from public.resenas
where aprobada = true
group by producto_id;

-- Grants
grant select on public.resenas          to anon, authenticated;
grant insert on public.resenas          to authenticated;
grant select on public.resenas_aggregate to anon, authenticated;
