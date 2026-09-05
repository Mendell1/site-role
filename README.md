# Rolê — eventos do seu bairro

Plataforma web colaborativa para divulgar e descobrir eventos locais. O projeto reúne eventos que normalmente ficam espalhados em grupos de WhatsApp, redes sociais, cartazes e divulgação boca a boca.

## V25 experimental

A branch `v25-experimental` é a área de desenvolvimento das próximas versões. A V24 permanece preservada em `v24-stable` e o `main` continua como versão estável.

### V25.1 — Comunidade

- seguir e deixar de seguir organizadores;
- contador de seguidores no perfil público;
- notificação quando um organizador seguido publica um novo evento;
- selo de organizador verificado concedido/removido pela moderação;
- área **Alertas e seguindo** no perfil do usuário;
- alertas personalizados por categoria, cidade, gratuidade e fim de semana;
- alertas por distância de 5, 10, 25 ou 50 km usando geolocalização;
- pausa, reativação e exclusão de alertas;
- limite de 10 alertas por conta aplicado também no banco;
- notificação automática quando um novo evento combina com um alerta;
- RLS para seguidores e alertas, mantendo cada usuário restrito aos próprios dados.

### V25.2 — Participação

- inscrição real separada de **Tenho interesse**;
- capacidade baseada no campo `max_participantes` do evento;
- reserva de vaga com controle transacional no PostgreSQL;
- lista de espera automática quando o evento lota;
- promoção do primeiro da fila quando uma vaga é liberada;
- notificação automática ao usuário promovido;
- área **Minhas inscrições** no perfil;
- lista de inscritos e fila disponível para o organizador.

### V25.3 — Evento presencial

- ingresso individual com código aleatório e QR Code;
- o QR não expõe nome, e-mail ou ID público do participante;
- check-in realizado pelo organizador com validação no banco;
- leitura pela câmera quando o navegador oferece `BarcodeDetector`;
- validação manual do código como alternativa;
- proteção contra check-in duplicado;
- notificação ao participante quando a presença é registrada;
- painel presencial com inscritos, presentes, fila e taxa de comparecimento;
- lista de participantes com horário de check-in;
- opção de desfazer um check-in feito por engano;
- cancelamento de inscrição bloqueado depois do check-in.

### V25.4 — Aplicativo inteligente

- PWA instalável com manifesto, ícones próprios e modo `standalone`;
- Service Worker com cache apenas do frontend público e fallback básico offline;
- chamadas do Supabase e dados privados ficam fora do cache da PWA;
- experiência de instalação opcional, sem forçar prompt no usuário;
- Web Push real para avisos mesmo com o site fechado;
- ativação e desativação do Push por aparelho no perfil;
- chaves privadas VAPID e segredo do webhook mantidos fora do repositório;
- Edge Function envia Push a partir das notificações já criadas pelo Rolê;
- aba **✦ Para você** com recomendações usando favoritos, interesses, cidade, alertas e organizadores seguidos;
- motivos de recomendação visíveis nos cartões;
- busca inteligente em português por frase natural;
- interpretação de categoria, gratuidade, dia, período e localização;
- ranking de resultados por aderência aos filtros, similaridade textual e interesse do público.

Exemplo de busca inteligente:

> Quero algo grátis sábado à noite perto de Itaquera

O sistema transforma a frase em filtros estruturados antes de consultar e ordenar os eventos. A busca comum continua disponível para consultas simples.

### V25.5 — Revisão e acabamento

- carregamento dos módulos V25 limitado às páginas que realmente usam cada recurso;
- remoção do carregamento duplicado do módulo de comunidade em perfil, organizador e admin;
- revisão de modais, foco, tecla Escape e regiões `aria-live`;
- bloqueio correto da rolagem do fundo enquanto um modal está aberto;
- QR, painel presencial, participação e busca inteligente ajustados para telas pequenas;
- áreas de toque mínimas e foco visível nos controles adicionados pela V25;
- suporte a `prefers-reduced-motion`;
- convite de instalação da PWA menos invasivo e com pausa de 7 dias após dispensar;
- cache da PWA versionado novamente para evitar arquivos antigos após atualização;
- checklist de regressão e testes estáticos específicos da V25.5.

## Funcionalidades

- mural com busca, categorias e filtros;
- busca inteligente por linguagem natural;
- recomendações personalizadas **Para você**;
- mapa e calendário de eventos;
- localização **Perto de mim** por distância;
- publicação e edição de eventos com endereço, CEP, mapa, imagem e status;
- favoritos, interesse, inscrição e comentários;
- compartilhamento por link/WhatsApp, QR Code e Google Agenda/ICS;
- perfil público compartilhável do organizador;
- login por e-mail/senha e Google OAuth;
- onboarding obrigatório para maiores de 18 anos e aceite dos termos;
- notificações internas e Web Push opcional;
- PWA instalável;
- denúncias com evidência privada, acompanhamento, recurso e auditoria;
- painel administrativo com moderação, usuários, eventos, auditoria e métricas;
- exclusão de conta com prazo de 7 dias e reautenticação recente.

## Tecnologias

Frontend em HTML, CSS e JavaScript, com Leaflet para mapas, Web App Manifest, Service Worker, Push API e Notifications API. Backend em Supabase: PostgreSQL, Auth, Storage, Realtime, Row Level Security, funções SQL/PLpgSQL, `pg_trgm`, Cron e Edge Functions. O ingresso usa um adaptador de QR no navegador com fallback de biblioteca. O Web Push é enviado no servidor pela Edge Function com VAPID. Publicação do frontend via GitHub Pages.

## Estrutura principal

- `index.html` — mural e descoberta;
- `perfil.html` — conta, perfil, favoritos, inscrições e eventos do usuário;
- `organizador.html` — perfil público compartilhável;
- `admin.html` — moderação e métricas;
- `manifest.webmanifest` — configuração instalável da PWA;
- `sw-v25.js` — cache público, Push e abertura de notificações;
- `js/participacao-v25.js` — inscrição, capacidade e fila de espera;
- `js/checkin-v25.js` — ingresso, scanner e painel presencial;
- `js/pwa-v25.js` — instalação e estado offline;
- `js/inteligencia-v25.js` — recomendações e busca inteligente;
- `js/push-v25.js` — assinatura de notificações por aparelho;
- `js/revisao-v25.js` — acabamento de UX, foco e modais da V25.5;
- `css/revisao-v25.css` — ajustes mobile/acessibilidade da V25.5;
- `supabase/functions/push-notificar-v25-4/` — envio server-side de Web Push;
- `js/` — autenticação, eventos, perfil, admin e recursos sociais;
- `css/` — identidade visual e responsividade;
- `supabase/migrations/` — histórico aplicado no banco conectado;
- `sql/` — baseline, migrations legíveis e scripts de deployment;
- `supabase/functions/` — Edge Functions do projeto.

## Executar localmente

Sirva a pasta por HTTP para que autenticação, geolocalização, câmera e APIs do navegador funcionem corretamente. Para PWA, Service Worker e Push, use um contexto seguro (`https` ou `localhost`). O `js/config.js` deve conter apenas a URL do projeto e uma chave pública/publishable do Supabase.

## Banco de dados

Para uma instalação nova, siga `sql/install/README.md`. A instalação usa RLS como camada principal de autorização; esconder botões no frontend não é considerado controle de segurança.

As tabelas de assinatura e entrega de Push possuem RLS e não recebem acesso direto de `anon` ou `authenticated`; as alterações do usuário passam por RPCs específicas. A configuração VAPID fica no schema privado e não é versionada.

## Segurança

- evidências de denúncia ficam em bucket privado;
- uploads de eventos e avatares possuem limite de tamanho e MIME no Storage;
- operações administrativas validam o papel no banco;
- contas bloqueadas, suspensas, incompletas ou em exclusão não podem operar normalmente;
- QR de ingresso utiliza um UUID aleatório próprio da inscrição e não carrega dados pessoais;
- check-in só pode ser executado pelo organizador do evento ou pela administração;
- Service Worker não armazena respostas do Supabase nem dados privados da sessão;
- Web Push exige assinatura vinculada ao usuário e segredo privado entre banco e Edge Function;
- chave privada VAPID, segredo do webhook, `service_role` e Client Secrets não devem ser publicados no GitHub;
- exclusão de conta exige autenticação recente no servidor.

## Testes

O workflow de CI executa validação sintática dos arquivos JavaScript e os testes estáticos `tests/smoke.py`, `tests/v25_2_static.py` e `tests/v25_5_static.py`. O roteiro manual de entrega está em `tests/V25.5-CHECKLIST.md` e cobre visitante, usuário, capacidade/fila, organizador, admin, PWA/Push, mobile e acessibilidade.

Antes de congelar uma nova versão estável, os fluxos críticos devem ser testados manualmente no preview, principalmente cadastro/login, publicação, inscrição, fila, ingresso, check-in, instalação PWA, Push, recomendações, busca inteligente, mapa, denúncias, moderação e exclusão.

## Deploy

O frontend é publicado pelo GitHub Pages. Alterações de banco devem ser registradas em migration e aplicadas ao Supabase antes de depender delas no frontend. A prévia da V25 permanece separada do site estável para evitar regressões durante os testes.
