

# Sistema Central Vision AI

## Visão Geral
Sistema interno de gestão completo para a agência Vision AI, com 5 módulos principais, tema escuro sofisticado e integração total com Supabase.

---

## Fase 1 — Fundação (Identidade Visual + Layout + Auth)

### Autenticação
- Tela de login com email/senha via Supabase Auth (single-user)
- Proteção de rotas — todas as páginas exigem login

### Layout Principal
- **Sidebar fixa** à esquerda com logo Vision AI e navegação entre os 5 módulos (Dashboard, CRM, Comunicações, Contratos, Financeiro)
- **Header** com logo e informações do usuário
- Tema escuro com fundo #0a0a0a, cards #111111, gradiente primário roxo→ciano (#6c47ff → #00d4ff)
- Cards com bordas sutis e efeito glass, tipografia moderna, animações suaves

---

## Fase 2 — Banco de Dados

### Tabelas novas no Supabase
- **comunicacoes** — registro de emails e WhatsApps enviados/recebidos por lead
- **contratos** — dados do cliente, tipo de serviço, status, valor total, PDF
- **parcelas** — parcelas de cada contrato com data de vencimento e status
- **recorrencias** — mensalidades ativas vinculadas a contratos
- **custos** — custos fixos da agência (VPS, APIs, ferramentas)

### Ajustes na tabela leads
- A tabela já existe — será utilizada como está, apenas conectando ao pipeline kanban pelo campo `status`

### Políticas RLS
- Todas as tabelas com acesso restrito a usuários autenticados

---

## Fase 3 — Dashboard Home

### KPIs em cards no topo
- Total de leads do mês
- Reuniões agendadas no mês
- Taxa de resposta de emails (%)
- Taxa de resposta de WhatsApp (%)
- Faturamento do mês (desenvolvimento + recorrente)
- Margem líquida (faturamento - custos)

### Gráficos e listas
- Gráfico de barras: leads por semana (últimos 30 dias)
- Gráfico de linha: faturamento dos últimos 6 meses (desenvolvimento vs recorrente)
- Lista dos 5 leads mais recentes com score e status
- Lista de próximos pagamentos a vencer (7 dias)

---

## Fase 4 — CRM Pipeline de Leads

### Kanban com drag and drop
- 8 colunas: Novo → Enriquecido → Contatado → Qualificado → Reunião Agendada → Proposta Enviada → Fechado → Perdido
- Arrastar cards entre colunas atualiza o status no Supabase

### Cards do kanban
- Nome, empresa, score (badge colorido), ícones de email/WhatsApp com status, badge de prioridade, data de entrada

### Painel lateral (drawer) ao clicar no lead
- Dados pessoais e dados enriquecidos (LinkedIn, resumo da empresa)
- Análise da IA: score, segmento, porte, maturidade digital, dores, oportunidades
- Timeline de interações (emails, WhatsApp, reuniões)
- Botões para preparar email, mover de coluna, campo de anotações internas

---

## Fase 5 — Comunicações

### Aba Email
- Métricas: enviados, abertos, respondidos, taxa de conversão
- Lista de emails enviados com nome do lead, empresa, data, status
- Modal "Novo Email": campo Para (busca por lead), assunto, editor de texto rico, preview com identidade visual Vision AI, botão Enviar

### Aba WhatsApp
- Métricas: mensagens enviadas, respondidas, reuniões agendadas, taxa de resposta
- Lista de conversas com leads (nome, empresa, última mensagem, status)

*Nota: O envio real de emails (via Resend) e WhatsApp será preparado na interface, mas a integração com APIs externas será configurada separadamente com as chaves necessárias.*

---

## Fase 6 — Contratos

### Lista de contratos
- Cliente, tipo de serviço, status, valor total, receita recorrente mensal, próximo vencimento

### Novo Contrato
- Upload de PDF do contrato com armazenamento no Supabase Storage
- Extração automática de dados do PDF via Edge Function (nome do cliente, tipo de serviço, valores, estrutura de pagamento)
- Revisão e edição dos campos antes de salvar
- Geração automática da timeline de parcelas

### Painel lateral do contrato
- Dados completos do contrato
- Timeline de pagamentos com status (pago, pendente, vencido)
- Botão "Confirmar Pagamento" em cada parcela
- Histórico de notificações enviadas

### Notificações automáticas (Edge Functions)
- 1 dia antes do vencimento: WhatsApp + email para o cliente
- No dia do vencimento (se não pago): novo WhatsApp + email
- Cópia de todas as notificações para o dono da agência

---

## Fase 7 — Financeiro

### Receita de Desenvolvimento
- Lista de projetos com pagamentos ativos (cliente, valor total, recebido, pendente)
- Gráfico de barras mensal

### Receita Recorrente (MRR)
- Lista de contratos com mensalidade ativa, MRR total em destaque
- Gráfico de evolução do MRR, churn de contratos

### Custos Fixos
- Formulário para cadastrar custos (nome, categoria, valor mensal, data renovação)
- Lista de custos ativos, total mensal em destaque

### Resumo Financeiro
- Cards: receita total, custos totais, margem líquida com percentual
- Gráfico comparativo dos últimos 6 meses

