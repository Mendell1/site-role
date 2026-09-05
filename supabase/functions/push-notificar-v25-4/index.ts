import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' }
});

const uuidValido = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'json_invalido' }, 400); }
  if (!uuidValido(body?.notificacao_id) || typeof body?.segredo !== 'string') {
    return json({ error: 'payload_invalido' }, 400);
  }

  const { data: cfgRows, error: cfgError } = await supabase.rpc('push_config_servidor_v25_4');
  if (cfgError) return json({ error: 'config_indisponivel' }, 500);
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : cfgRows;
  if (!cfg?.public_key || !cfg?.private_key || !cfg?.webhook_secret) {
    return json({ error: 'push_nao_configurado' }, 503);
  }
  if (body.segredo !== cfg.webhook_secret) return json({ error: 'nao_autorizado' }, 403);

  const { data: notificacao, error: notifError } = await supabase
    .from('notificacoes')
    .select('id,usuario_id,titulo,mensagem,evento_id,denuncia_id')
    .eq('id', body.notificacao_id)
    .maybeSingle();
  if (notifError) return json({ error: 'falha_notificacao' }, 500);
  if (!notificacao) return json({ error: 'notificacao_nao_encontrada' }, 404);

  const { data: assinaturas, error: assError } = await supabase
    .from('push_assinaturas_v25_4')
    .select('id,endpoint,p256dh,auth')
    .eq('usuario_id', notificacao.usuario_id)
    .eq('ativo', true);
  if (assError) return json({ error: 'falha_assinaturas' }, 500);
  if (!assinaturas?.length) return json({ ok: true, enviados: 0, motivo: 'sem_assinaturas' });

  webpush.setVapidDetails(cfg.subject || 'mailto:role-notificacoes@example.invalid', cfg.public_key, cfg.private_key);

  const destino = notificacao.evento_id
    ? `index.html?evento=${encodeURIComponent(notificacao.evento_id)}`
    : 'perfil.html';
  const payload = JSON.stringify({
    titulo: notificacao.titulo || 'Rolê',
    mensagem: notificacao.mensagem || 'Você tem uma novidade no Rolê.',
    url: destino,
    tag: `role-${notificacao.id}`
  });

  let enviados = 0;
  let erros = 0;
  let ignorados = 0;

  for (const assinatura of assinaturas) {
    const { data: entrega } = await supabase
      .from('push_entregas_v25_4')
      .select('status')
      .eq('notificacao_id', notificacao.id)
      .eq('assinatura_id', assinatura.id)
      .maybeSingle();
    if (entrega?.status === 'enviado') { ignorados++; continue; }

    try {
      await webpush.sendNotification({
        endpoint: assinatura.endpoint,
        keys: { p256dh: assinatura.p256dh, auth: assinatura.auth }
      }, payload, { TTL: 86400, urgency: 'normal' });

      await supabase.from('push_entregas_v25_4').upsert({
        notificacao_id: notificacao.id,
        assinatura_id: assinatura.id,
        status: 'enviado',
        erro: null,
        tentativas: 1,
        enviado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'notificacao_id,assinatura_id' });
      enviados++;
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || err?.status || 0);
      const expirado = statusCode === 404 || statusCode === 410;
      if (expirado) {
        await supabase.from('push_assinaturas_v25_4')
          .update({ ativo: false, atualizado_em: new Date().toISOString() })
          .eq('id', assinatura.id);
      }
      await supabase.from('push_entregas_v25_4').upsert({
        notificacao_id: notificacao.id,
        assinatura_id: assinatura.id,
        status: expirado ? 'expirado' : 'erro',
        erro: String(err?.message || 'falha_web_push').slice(0, 800),
        tentativas: 1,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'notificacao_id,assinatura_id' });
      erros++;
    }
  }

  return json({ ok: true, enviados, erros, ignorados });
});
