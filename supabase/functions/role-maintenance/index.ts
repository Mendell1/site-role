import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function getSecretKey(): string {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    try {
      const parsed = JSON.parse(modern);
      if (parsed?.default) return parsed.default;
    } catch (_) {}
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("Chave administrativa do Supabase não disponível");
}

async function removerPasta(admin: any, bucket: string, pasta: string) {
  let removidos = 0;
  // Sempre recomeça na primeira página após cada remoção, porque a lista encolhe.
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(pasta, {
      limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`Falha ao listar ${bucket}/${pasta}: ${error.message}`);
    if (!data || data.length === 0) break;
    const arquivos = data.filter((item: any) => item.id).map((item: any) => `${pasta}/${item.name}`);
    if (arquivos.length) {
      const { error: removeError } = await admin.storage.from(bucket).remove(arquivos);
      if (removeError) throw new Error(`Falha ao remover arquivos de ${bucket}: ${removeError.message}`);
      removidos += arquivos.length;
    }
    if (data.length < 1000) break;
  }
  return removidos;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return Response.json({ ok:false, erro:"Método não permitido" }, { status:405 });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL não disponível");
    const admin = createClient(supabaseUrl, getSecretKey(), {
      auth: { persistSession:false, autoRefreshToken:false }
    });

    const fornecido = req.headers.get("x-role-cron-secret") || "";
    const { data:cfg, error:cfgError } = await admin.from("internal_config")
      .select("valor").eq("chave","maintenance_secret").single();
    if (cfgError || !cfg?.valor || fornecido !== cfg.valor)
      return Response.json({ ok:false, erro:"Não autorizado" }, { status:401 });

    const { data:vencidas, error:perfisError } = await admin.from("perfis")
      .select("id").not("exclusao_prevista","is",null)
      .lte("exclusao_prevista",new Date().toISOString()).limit(200);
    if (perfisError) throw perfisError;

    const contas:any[]=[];
    for (const perfil of (vencidas || [])) {
      try {
        let arquivos=0;
        for (const bucket of ["avatares","eventos","denuncias"])
          arquivos += await removerPasta(admin,bucket,perfil.id);
        const { error:deleteError } = await admin.auth.admin.deleteUser(perfil.id);
        if (deleteError) throw deleteError;
        contas.push({ usuario_id:perfil.id, ok:true, arquivos_removidos:arquivos });
      } catch (e) {
        contas.push({ usuario_id:perfil.id, ok:false, erro:e instanceof Error?e.message:String(e) });
      }
    }
    return Response.json({ ok:true, processadas:contas.length, contas });
  } catch (e) {
    return Response.json({ ok:false, erro:e instanceof Error?e.message:String(e) }, { status:500 });
  }
});