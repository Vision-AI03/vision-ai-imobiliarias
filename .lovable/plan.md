

# Corrigir exibição dos dados de enriquecimento no CRM

## Problema identificado

Existem dois problemas:

1. **O drawer nao atualiza apos enriquecimento**: Quando o usuario clica em "Enriquecer com IA", a funcao roda com sucesso no backend e salva os dados no banco, mas o componente `LeadDrawer` nao recarrega os dados do lead. O `handleStatusChange` so atualiza o campo `status`, nao os demais campos enriquecidos (score, segmento, dores, etc.).

2. **Instagram/LinkedIn so aparecem se preenchidos**: A raspagem de perfis so acontece se os campos `linkedin_url` e `instagram_url` estiverem preenchidos. Caso contrario, a funcao pula essas etapas silenciosamente.

## Solucao

### 1. Atualizar o drawer apos enriquecimento

No `LeadDrawer.tsx`, apos o enriquecimento bem-sucedido, buscar os dados atualizados do lead no banco e atualizar o estado local:

- Na funcao `handleEnrichLead`, apos o sucesso, fazer um `select` do lead atualizado no Supabase
- Propagar os dados atualizados para o componente pai via um novo callback `onLeadUpdate`

### 2. Propagar atualizacao no CRM.tsx

- Adicionar uma prop `onLeadUpdate` no `LeadDrawer` que atualiza o lead tanto na lista `leads` quanto no `drawerLead`
- Quando o enriquecimento terminar, chamar esse callback com o lead atualizado

### 3. Feedback visual das fontes raspadas

- Apos o enriquecimento, exibir um resumo indicando quais fontes foram utilizadas (Site, Busca, LinkedIn, Instagram) com checkmarks

## Detalhes Tecnicos

### Arquivo: `src/components/crm/LeadDrawer.tsx`

- Adicionar prop `onLeadUpdate: (lead: Lead) => void` na interface `LeadDrawerProps`
- Na funcao `handleEnrichLead`, apos sucesso:
  - Fazer `supabase.from("leads").select("*").eq("id", lead.id).single()` para obter dados atualizados
  - Chamar `onLeadUpdate(updatedLead)` com o lead atualizado
- Atualizar o toast de sucesso para incluir Instagram: `Instagram: ${data.sources?.instagram_scraped ? "ok" : "nao"}`

### Arquivo: `src/pages/CRM.tsx`

- Criar funcao `handleLeadUpdate(updatedLead: Lead)` que:
  - Atualiza o lead na lista `leads` via `setLeads`
  - Atualiza o `drawerLead` via `setDrawerLead`
- Passar `onLeadUpdate={handleLeadUpdate}` para o componente `LeadDrawer`

### Arquivo: `supabase/functions/enrich-lead/index.ts`

- Adicionar `instagram_scraped` no objeto `sources` da resposta (ja existe no codigo mas precisa confirmar que esta retornando corretamente)

