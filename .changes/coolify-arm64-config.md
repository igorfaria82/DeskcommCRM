---
impacto: exige_acao
secao: corrigido
titulo: Instalação deste fork no Coolify preserva os ajustes da VPS ARM64
---

O Compose desta instalação usa WAHA NOWEB 2026.7.2 para ARM64, deixa o Caddy em
profile opcional e entrega a CA pública do Supabase aos serviços que a utilizam.
Os aliases da chave WAHA preservam as variáveis anteriores como alternativa.
Antes do redeploy, mantenha a preservação do repositório ligada e confira os
vínculos dos volumes no recurso existente. Uma WAHA_IMAGE cadastrada no Coolify
continua prevalecendo e precisa apontar para a variante ARM64 nesta VPS.
