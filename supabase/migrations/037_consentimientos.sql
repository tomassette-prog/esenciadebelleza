-- Registro de consentimientos RGPD para comunicaciones comerciales por email
-- Prueba de consentimiento: guarda el texto exacto aceptado, su fecha y el origen.

create table if not exists public.consentimientos (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  origen            text not null check (origen in ('checkout', 'newsletter', 'registro')),
  texto_aceptado    text not null,
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'confirmado', 'baja')),
  token_confirmacion uuid not null default gen_random_uuid(),
  confirmado_at     timestamptz,
  baja_at           timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists consentimientos_email_idx  on public.consentimientos (lower(email));
create index if not exists consentimientos_token_idx  on public.consentimientos (token_confirmacion);
create index if not exists consentimientos_estado_idx on public.consentimientos (estado);

-- Sin políticas RLS: solo el service role (servidor) accede.
alter table public.consentimientos enable row level security;
revoke all on table public.consentimientos from anon, authenticated;

-- service_role necesita GRANT explícito: RLS no sustituye privilegios de tabla
-- (en este proyecto los default privileges no cubren service_role, ver 002_grants.sql)
grant select, insert, update, delete on table public.consentimientos to service_role;
