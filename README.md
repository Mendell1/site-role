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

## Funcionalidades

- mural com busca, categorias e filtros;
- mapa e calendário de eventos;
- localização **Perto de mim** por distância;
- publicação e edição de eventos com endereço, CEP, mapa, imagem e status;
- favoritos, interesse, inscrição e comentários;
- compartilhamento por link/WhatsApp, QR Code e Google Agenda/ICS;
- perfil público compartilhável do organizador;
- login por e-mail/senha e Google OAuth;
- onboarding obrigatório para maiores de 18 anos e aceite dos termos;
- notificações de mudanças nos eventos e resumo semanal opcional;
- denúncias com evidência privada, acompanhamento, recurso e auditoria;
- painel administrativo com moderação, usuários, eventos, auditoria e métricas;
- exclusão de conta com prazo de 7 dias e reautenticação recente.

## Tecnologias

Frontend em HTML, CSS e JavaScript, com Leaflet para mapas. Backend em Supabase: PostgreSQL, Auth, Storage, Realtime, Row Level Security, funções SQL/PLpgSQL, Cron e Edge Functions. O ingresso usa o pacote `qrcode` 1.5.4 carregado de forma fixada para desenhar o QR no navegador. Publicação do frontend via GitHub Pages.

## Estrutura principal

- `index.html` — mural e descoberta;
- `perfil.html` — conta, perfil, favoritos, inscrições e eventos do usuário;
- `organizador.html` — perfil público compartilhável;
- `admin.html` — moderação e métricas;
- `js/participacao-v25.js` — inscrição, capacidade e fila de espera;
- `js/checkin-v25.js` — ingresso, scanner e painel presencial;
- `js/` — autenticação, eventos, perfil, admin e recursos sociais;
- `css/` — identidade visual e responsividade;
- `supabase/migrations/` — histórico aplicado no banco conectado;
- `sql/` — baseline, migrations legíveis e scripts de deployment;
- `supabase/functions/` — Edge Functions do projeto.

## Executar localmente

Sirva a pasta por HTTP para que autenticação, geolocalização, câmera e APIs do navegador funcionem corretamente. O `js/config.js` deve conter apenas a URL do projeto e uma chave pública/publishable do Supabase.

## Banco de dados

Para uma instalação nova, siga `sql/install/README.md`. A instalação usa RLS como camada principal de autorização; esconder botões no frontend não é considerado controle de segurança.

## Segurança

- evidências de denúncia ficam em bucket privado;
- uploads de eventos e avatares possuem limite de tamanho e MIME no Storage;
- operações administrativas validam o papel no banco;
- contas bloqueadas, suspensas, incompletas ou em exclusão não podem operar normalmente;
- QR de ingresso utiliza um UUID aleatório próprio da inscrição e não carrega dados pessoais;
- check-in só pode ser executado pelo organizador do evento ou pela administração;
- exclusão de conta exige autenticação recente no servidor;
- nenhum `service_role` ou Client Secret deve ser publicado no GitHub.

## Testes

O workflow de CI executa validação sintática dos arquivos JavaScript e testes estáticos de integração em `tests/smoke.py`, incluindo os módulos da V25. Antes de uma entrega, também é recomendado testar manualmente os fluxos de e-mail, Google OAuth, publicação, inscrição, fila, ingresso, check-in, mapa, notificações, denúncias, recurso, moderação e exclusão.

## Deploy

O frontend é publicado pelo GitHub Pages. Alterações de banco devem ser registradas em migration e aplicadas ao Supabase antes de depender delas no frontend.
