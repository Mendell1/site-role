# Rolê — eventos do seu bairro

Plataforma web colaborativa para divulgar e descobrir eventos locais. O projeto reúne eventos que normalmente ficam espalhados em grupos de WhatsApp, redes sociais, cartazes e divulgação boca a boca.

## Funcionalidades

- mural com busca, categorias e filtros;
- mapa e calendário de eventos;
- localização **Perto de mim** por distância;
- publicação e edição de eventos com endereço, CEP, mapa, imagem e status;
- favoritos, interesse e comentários;
- compartilhamento por link/WhatsApp, QR Code e Google Agenda/ICS;
- perfil público compartilhável do organizador;
- login por e-mail/senha e Google OAuth;
- onboarding obrigatório para maiores de 18 anos e aceite dos termos;
- notificações de mudanças nos eventos e resumo semanal opcional;
- denúncias com evidência privada, acompanhamento, recurso e auditoria;
- painel administrativo com moderação, usuários, eventos, auditoria e métricas;
- exclusão de conta com prazo de 7 dias e reautenticação recente.

## Tecnologias

Frontend em HTML, CSS e JavaScript, com Leaflet para mapas. Backend em Supabase: PostgreSQL, Auth, Storage, Realtime, Row Level Security, funções SQL/PLpgSQL, Cron e Edge Functions. Publicação do frontend via GitHub Pages.

## Estrutura principal

- `index.html` — mural e descoberta;
- `perfil.html` — conta, perfil, favoritos e eventos do usuário;
- `organizador.html` — perfil público compartilhável;
- `admin.html` — moderação e métricas;
- `js/` — autenticação, eventos, perfil, admin e recursos sociais;
- `css/` — identidade visual e responsividade;
- `supabase/migrations/` — histórico aplicado no banco conectado;
- `sql/` — baseline, migrations legíveis e scripts de deployment;
- `supabase/functions/` — Edge Functions do projeto.

## Executar localmente

Sirva a pasta por HTTP para que autenticação, geolocalização e APIs do navegador funcionem corretamente. O `js/config.js` deve conter apenas a URL do projeto e uma chave pública/publishable do Supabase.

## Banco de dados

Para uma instalação nova, siga `sql/install/README.md`. A instalação usa RLS como camada principal de autorização; esconder botões no frontend não é considerado controle de segurança.

## Segurança

- evidências de denúncia ficam em bucket privado;
- uploads de eventos e avatares possuem limite de tamanho e MIME no Storage;
- operações administrativas validam o papel no banco;
- contas bloqueadas, suspensas, incompletas ou em exclusão não podem operar normalmente;
- exclusão de conta exige autenticação recente no servidor;
- nenhum `service_role` ou Client Secret deve ser publicado no GitHub.

## Testes

O workflow de CI executa validação sintática dos arquivos JavaScript e testes estáticos de integração em `tests/smoke.py`. Antes de uma entrega, também é recomendado testar manualmente os fluxos de e-mail, Google OAuth, publicação, mapa, notificações, denúncias, recurso, moderação e exclusão.

## Deploy

O frontend é publicado pelo GitHub Pages. Alterações de banco devem ser registradas em migration e aplicadas ao Supabase antes de depender delas no frontend.
