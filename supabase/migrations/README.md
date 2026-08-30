# Supabase migrations

Esta pasta segue o formato oficial usado pela integração GitHub do Supabase.

## Estado atual

O banco de produção já possui um histórico de migrations aplicado manualmente antes da integração com GitHub.  
Por segurança, os arquivos históricos desta pasta são marcadores de baseline com os mesmos números de versão já registrados no projeto remoto.

Isso evita que a integração tente reaplicar migrations antigas no banco de produção.

## Regra para novas alterações

A partir de agora, toda alteração de schema deve ser adicionada aqui como uma nova migration, usando um timestamp maior que a última versão atual.

Exemplo:

```
20260830090000_nome_da_alteracao.sql
```

Não edite migrations históricas já aplicadas.

Para instalar o projeto do zero, consulte também:

```
sql/install/000_instalacao_completa.sql
```

e a documentação em `sql/README.md`.
