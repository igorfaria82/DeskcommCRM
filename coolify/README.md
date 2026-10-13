# Configuração desta instalação no Coolify

Destino: infraestrutura do fork; preserva os serviços e os volumes persistentes.

O WAHA usa por padrão `devlikeapro/waha:noweb-arm-2026.7.2`, nativo para esta VPS
ARM64 e compatível com o engine NOWEB. Uma `WAHA_IMAGE` já salva no Coolify prevalece
sobre esse padrão: se ela ainda aponta para `latest-2026.7.2`, atualize somente essa
variável para `devlikeapro/waha:noweb-arm-2026.7.2`. Em AMD64, escolha explicitamente
`devlikeapro/waha:latest-2026.7.2`.

O Caddy continua definido, mas só é iniciado com o profile
`caddy-nao-usado-com-proxy-externo`. Nesta instalação, o Coolify gerencia domínio e
HTTPS, encaminhando para o serviço `app` na porta interna 3000. Não ative esse
profile junto ao proxy que já ocupa 80/443.

Os aliases opcionais `CRM_WAHA_API_KEY` e `CRM_WAHA_API_KEY_SHA512` evitam colisão de
nomes no painel. O primeiro é a chave em plaintext; o segundo é o SHA512 hexadecimal
da mesma chave, sem prefixo `sha512:`. Se estiverem ausentes ou vazios, continuam
valendo as variáveis anteriores `WAHA_API_KEY` e `WAHA_API_KEY_SHA512`. Não gere
novas credenciais para fazer esta migração. O app recebe a chave em plaintext; o
WAHA recebe o hash com o prefixo necessário.

`supabase-ca.crt` é o certificado público oficial do Supabase, sem chave privada:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Ele é montado somente para leitura no app, worker e runtime opcional de voz.
`NODE_EXTRA_CA_CERTS` adiciona essa CA à confiança do Node, sem desligar TLS.
Mantenha **Preserve repository during deployment** ligado no Coolify para que o
arquivo exista no diretório usado pelo Compose. O bind recusa arquivo ausente em
vez de criar um diretório no lugar do certificado.

Após atualizar o código, recarregue o Compose no recurso existente e confira a
imagem efetiva, os mounts da CA e os vínculos dos volumes antes de fazer o redeploy.
Preserve o mesmo recurso e os volumes `waha-data`, `waha-media` e os demais volumes
da instalação. Não use `docker compose down -v` nem limpeza de volumes.

O webhook continua em `http://app:3000/api/v1/webhooks/waha`, pela rede interna.
As regras Traefik manuais antigas não são restauradas: o Coolify mantém o
roteamento do site e a aplicação mantém suas guardas atuais.
