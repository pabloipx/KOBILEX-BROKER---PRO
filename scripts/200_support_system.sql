-- Sistema de suporte humano em tempo real.
-- Rode este arquivo inteiro no SQL Editor do Supabase. Ele e idempotente:
-- pode ser executado de novo sem perder dados.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Equipe de atendimento
-- ---------------------------------------------------------------------------
create table if not exists public.support_agents (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  password_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Conversas
-- ---------------------------------------------------------------------------
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text check (category in ('saques', 'depositos', 'tecnico', 'acesso', 'recuperacao', 'operacoes', 'outro')),
  status text not null default 'new'
    check (status in ('new', 'waiting_agent', 'in_progress', 'waiting_customer', 'completed')),
  assigned_agent_id uuid references public.support_agents(id) on delete set null,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.support_agents(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.support_agents(id) on delete set null,
  constraint support_conversations_closed_consistency
    check ((status = 'completed') = (closed_at is not null))
);

-- No maximo uma conversa ativa por cliente. Protege contra clique duplo e abas simultaneas.
create unique index if not exists support_conversations_one_active_per_user
  on public.support_conversations (user_id) where status <> 'completed';
create index if not exists support_conversations_status_activity_idx
  on public.support_conversations (status, last_message_at desc);
create index if not exists support_conversations_user_idx
  on public.support_conversations (user_id, created_at desc);
create index if not exists support_conversations_category_idx on public.support_conversations (category);
create index if not exists support_conversations_agent_idx on public.support_conversations (assigned_agent_id);
create index if not exists support_conversations_activity_idx on public.support_conversations (last_message_at desc);
create index if not exists support_conversations_closed_idx on public.support_conversations (closed_at desc);

-- ---------------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id uuid primary key,
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid,
  sender_role text not null check (sender_role in ('customer', 'agent', 'system')),
  kind text not null default 'text'
    check (kind in ('text', 'welcome', 'category', 'confirmation', 'closed', 'reopened')),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);
create index if not exists support_messages_unread_idx
  on public.support_messages (conversation_id, sender_role) where read_at is null;

-- ---------------------------------------------------------------------------
-- Notas internas (nunca visiveis ao cliente) e trilha de auditoria
-- ---------------------------------------------------------------------------
create table if not exists public.support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  admin_id uuid references public.support_agents(id) on delete set null,
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists support_internal_notes_conversation_idx
  on public.support_internal_notes (conversation_id, created_at);

create table if not exists public.support_audit_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  actor_id uuid,
  actor_role text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists support_audit_log_conversation_idx
  on public.support_audit_log (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- O app acessa estas tabelas pelo servidor. As politicas abaixo garantem que,
-- mesmo com a chave publica, um cliente so enxerga o que e dele.
-- ---------------------------------------------------------------------------
alter table public.support_agents enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_internal_notes enable row level security;
alter table public.support_audit_log enable row level security;

drop policy if exists "support_conversations_owner_select" on public.support_conversations;
create policy "support_conversations_owner_select" on public.support_conversations
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "support_messages_owner_select" on public.support_messages;
create policy "support_messages_owner_select" on public.support_messages
  for select to authenticated using (
    exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- support_agents, support_internal_notes e support_audit_log nao tem politicas:
-- ficam inacessiveis para anon/authenticated.
revoke all on public.support_agents from anon, authenticated;
revoke all on public.support_internal_notes from anon, authenticated;
revoke all on public.support_audit_log from anon, authenticated;
revoke insert, update, delete on public.support_conversations from anon, authenticated;
revoke insert, update, delete on public.support_messages from anon, authenticated;
revoke all on public.support_conversations from anon;
revoke all on public.support_messages from anon;

-- ---------------------------------------------------------------------------
-- View usada pelo painel (somente service role)
-- ---------------------------------------------------------------------------
create or replace view public.support_conversation_list with (security_invoker = true) as
select
  c.id,
  c.id::text as id_text,
  c.number,
  c.number::text as number_text,
  c.user_id,
  upper(left(c.user_id::text, 8)) as account_id,
  c.category,
  c.status,
  c.assigned_agent_id,
  a.name as assigned_agent_name,
  c.last_message_preview,
  c.last_message_at,
  c.created_at,
  c.updated_at,
  c.closed_at,
  c.closed_by,
  cb.name as closed_by_name,
  c.reopened_at,
  p.full_name as customer_name,
  p.nickname as customer_username,
  p.email as customer_email,
  (
    select count(*)::int from public.support_messages m
    where m.conversation_id = c.id and m.sender_role = 'customer' and m.read_at is null
  ) as unread_count
from public.support_conversations c
join public.profiles p on p.id = c.user_id
left join public.support_agents a on a.id = c.assigned_agent_id
left join public.support_agents cb on cb.id = c.closed_by;

revoke all on public.support_conversation_list from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Operacoes atomicas. Executadas apenas pelo servidor (service role).
-- Erros usam o prefixo SUPPORT: para o servidor traduzir em mensagens PT-BR.
-- ---------------------------------------------------------------------------
create or replace function public.support_start_conversation(p_user_id uuid, p_welcome text)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  v public.support_conversations;
begin
  select * into v from support_conversations
  where user_id = p_user_id and status <> 'completed'
  order by created_at desc limit 1;
  if found then return v; end if;

  begin
    insert into support_conversations (user_id) values (p_user_id) returning * into v;
  exception when unique_violation then
    select * into v from support_conversations
    where user_id = p_user_id and status <> 'completed' limit 1;
    return v;
  end;

  insert into support_messages (id, conversation_id, sender_role, kind, message, read_at)
  values (gen_random_uuid(), v.id, 'system', 'welcome', p_welcome, now());

  insert into support_audit_log (conversation_id, actor_id, actor_role, action)
  values (v.id, p_user_id, 'customer', 'created');

  return v;
end $$;

create or replace function public.support_set_category(
  p_conversation_id uuid, p_user_id uuid, p_category text, p_label text, p_confirmation text
)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  v public.support_conversations;
begin
  select * into v from support_conversations where id = p_conversation_id for update;
  if not found then raise exception 'SUPPORT:not_found'; end if;
  if v.user_id <> p_user_id then raise exception 'SUPPORT:forbidden'; end if;
  if v.status = 'completed' then raise exception 'SUPPORT:closed'; end if;
  if v.category is not null then return v; end if;

  insert into support_messages (id, conversation_id, sender_id, sender_role, kind, message)
  values (gen_random_uuid(), v.id, p_user_id, 'customer', 'category', p_label);

  insert into support_messages (id, conversation_id, sender_role, kind, message, read_at, created_at)
  values (gen_random_uuid(), v.id, 'system', 'confirmation', p_confirmation, now(), now() + interval '1 millisecond');

  update support_conversations
  set category = p_category,
      status = 'waiting_agent',
      last_message_at = now(),
      last_message_preview = p_label,
      updated_at = now()
  where id = v.id
  returning * into v;

  insert into support_audit_log (conversation_id, actor_id, actor_role, action, details)
  values (v.id, p_user_id, 'customer', 'category_selected', jsonb_build_object('category', p_category));

  return v;
end $$;

create or replace function public.support_post_message(
  p_message_id uuid,
  p_conversation_id uuid,
  p_sender_id uuid,
  p_sender_role text,
  p_message text,
  p_allow_override boolean default false
)
returns public.support_messages
language plpgsql security definer set search_path = public as $$
declare
  v public.support_conversations;
  m public.support_messages;
begin
  if p_sender_role not in ('customer', 'agent') then raise exception 'SUPPORT:invalid_role'; end if;

  select * into v from support_conversations where id = p_conversation_id for update;
  if not found then raise exception 'SUPPORT:not_found'; end if;

  -- Reenvio do mesmo id (retry): devolve a mensagem ja salva sem duplicar.
  select * into m from support_messages where id = p_message_id;
  if found then
    if m.conversation_id <> p_conversation_id then raise exception 'SUPPORT:id_conflict'; end if;
    return m;
  end if;

  if p_sender_role = 'customer' then
    if v.user_id <> p_sender_id then raise exception 'SUPPORT:forbidden'; end if;
    if v.category is null then raise exception 'SUPPORT:category_required'; end if;
  else
    if v.assigned_agent_id is not null and v.assigned_agent_id <> p_sender_id and not p_allow_override then
      raise exception 'SUPPORT:assigned_to_other';
    end if;
  end if;
  if v.status = 'completed' then raise exception 'SUPPORT:closed'; end if;

  insert into support_messages (id, conversation_id, sender_id, sender_role, kind, message)
  values (p_message_id, p_conversation_id, p_sender_id, p_sender_role, 'text', p_message)
  returning * into m;

  if p_sender_role = 'customer' then
    update support_conversations
    set status = case when assigned_agent_id is null then 'waiting_agent' else 'in_progress' end,
        last_message_at = m.created_at,
        last_message_preview = left(p_message, 160),
        updated_at = now()
    where id = v.id;
  else
    -- Mensagens do cliente anteriores a resposta passam a contar como lidas.
    update support_messages set read_at = now()
    where conversation_id = v.id and sender_role = 'customer' and read_at is null;

    update support_conversations
    set status = 'waiting_customer',
        assigned_agent_id = coalesce(assigned_agent_id, p_sender_id),
        last_message_at = m.created_at,
        last_message_preview = left(p_message, 160),
        updated_at = now()
    where id = v.id;

    if v.assigned_agent_id is null then
      insert into support_audit_log (conversation_id, actor_id, actor_role, action, details)
      values (v.id, p_sender_id, 'agent', 'assigned', jsonb_build_object('agent_id', p_sender_id, 'auto', true));
    end if;
  end if;

  return m;
end $$;

create or replace function public.support_close_conversation(
  p_conversation_id uuid, p_agent_id uuid, p_allow_override boolean, p_closed_message text
)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  v public.support_conversations;
begin
  select * into v from support_conversations where id = p_conversation_id for update;
  if not found then raise exception 'SUPPORT:not_found'; end if;
  if v.status = 'completed' then return v; end if;
  if v.assigned_agent_id is not null and v.assigned_agent_id <> p_agent_id and not p_allow_override then
    raise exception 'SUPPORT:assigned_to_other';
  end if;

  insert into support_messages (id, conversation_id, sender_id, sender_role, kind, message)
  values (gen_random_uuid(), v.id, p_agent_id, 'system', 'closed', p_closed_message);

  update support_conversations
  set status = 'completed',
      closed_at = now(),
      closed_by = p_agent_id,
      assigned_agent_id = coalesce(assigned_agent_id, p_agent_id),
      updated_at = now()
  where id = v.id
  returning * into v;

  insert into support_audit_log (conversation_id, actor_id, actor_role, action)
  values (v.id, p_agent_id, 'agent', 'closed');

  return v;
end $$;

create or replace function public.support_reopen_conversation(
  p_conversation_id uuid, p_agent_id uuid, p_reopened_message text
)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  v public.support_conversations;
  previous_closed_at timestamptz;
  previous_closed_by uuid;
begin
  select * into v from support_conversations where id = p_conversation_id for update;
  if not found then raise exception 'SUPPORT:not_found'; end if;
  if v.status <> 'completed' then return v; end if;

  if exists (
    select 1 from support_conversations
    where user_id = v.user_id and status <> 'completed' and id <> v.id
  ) then
    raise exception 'SUPPORT:user_has_active';
  end if;

  previous_closed_at := v.closed_at;
  previous_closed_by := v.closed_by;

  update support_conversations
  set status = 'in_progress',
      closed_at = null,
      closed_by = null,
      reopened_at = now(),
      reopened_by = p_agent_id,
      assigned_agent_id = coalesce(assigned_agent_id, p_agent_id),
      last_message_at = now(),
      last_message_preview = p_reopened_message,
      updated_at = now()
  where id = v.id
  returning * into v;

  insert into support_messages (id, conversation_id, sender_id, sender_role, kind, message)
  values (gen_random_uuid(), v.id, p_agent_id, 'system', 'reopened', p_reopened_message);

  insert into support_audit_log (conversation_id, actor_id, actor_role, action, details)
  values (v.id, p_agent_id, 'agent', 'reopened',
          jsonb_build_object('previous_closed_at', previous_closed_at, 'previous_closed_by', previous_closed_by));

  return v;
end $$;

revoke all on function public.support_start_conversation(uuid, text) from public, anon, authenticated;
revoke all on function public.support_set_category(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.support_post_message(uuid, uuid, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.support_close_conversation(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.support_reopen_conversation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.support_start_conversation(uuid, text) to service_role;
grant execute on function public.support_set_category(uuid, uuid, text, text, text) to service_role;
grant execute on function public.support_post_message(uuid, uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.support_close_conversation(uuid, uuid, boolean, text) to service_role;
grant execute on function public.support_reopen_conversation(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
