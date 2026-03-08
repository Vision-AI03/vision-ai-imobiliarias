export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      comunicacoes: {
        Row: {
          assunto: string | null
          conteudo: string | null
          criado_em: string
          direcao: string
          id: string
          lead_id: string
          status: string
          tipo: string
        }
        Insert: {
          assunto?: string | null
          conteudo?: string | null
          criado_em?: string
          direcao: string
          id?: string
          lead_id: string
          status?: string
          tipo: string
        }
        Update: {
          assunto?: string | null
          conteudo?: string | null
          criado_em?: string
          direcao?: string
          id?: string
          lead_id?: string
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          atualizado_em: string
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          criado_em: string
          id: string
          pdf_url: string | null
          status: string
          tipo_servico: string
          valor_total: number
        }
        Insert: {
          atualizado_em?: string
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          criado_em?: string
          id?: string
          pdf_url?: string | null
          status?: string
          tipo_servico?: string
          valor_total?: number
        }
        Update: {
          atualizado_em?: string
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          criado_em?: string
          id?: string
          pdf_url?: string | null
          status?: string
          tipo_servico?: string
          valor_total?: number
        }
        Relationships: []
      }
      credentials: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          expira_em: string | null
          id: string
          nome: string
          notas: string | null
          servico: string
          tipo: string
          ultimo_uso: string | null
          updated_at: string | null
          url_servico: string | null
          user_id: string
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          expira_em?: string | null
          id?: string
          nome: string
          notas?: string | null
          servico: string
          tipo?: string
          ultimo_uso?: string | null
          updated_at?: string | null
          url_servico?: string | null
          user_id: string
          valor: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          expira_em?: string | null
          id?: string
          nome?: string
          notas?: string | null
          servico?: string
          tipo?: string
          ultimo_uso?: string | null
          updated_at?: string | null
          url_servico?: string | null
          user_id?: string
          valor?: string
        }
        Relationships: []
      }
      custos: {
        Row: {
          ativo: boolean
          categoria: string
          criado_em: string
          data_renovacao: string | null
          id: string
          nome: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          criado_em?: string
          data_renovacao?: string | null
          id?: string
          nome: string
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          criado_em?: string
          data_renovacao?: string | null
          id?: string
          nome?: string
          valor_mensal?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          data_email_enviado: string | null
          data_email_respondido: string | null
          data_reuniao: string | null
          data_whatsapp_enviado: string | null
          data_whatsapp_respondido: string | null
          dores_identificadas: string | null
          email: string
          email_enviado: boolean | null
          email_respondido: boolean | null
          empresa: string | null
          id: string
          instagram_url: string | null
          linkedin_cargo: string | null
          linkedin_url: string | null
          mensagem_original: string | null
          motivo_score: string | null
          nivel_maturidade_digital: string | null
          nome: string
          oportunidades: string | null
          origem: string | null
          porte_empresa: string | null
          prioridade_contato: string | null
          resumo_empresa: string | null
          reuniao_agendada: boolean | null
          score: number | null
          segmento: string | null
          site_descricao: string | null
          site_empresa: string | null
          site_titulo: string | null
          status: string | null
          telefone: string | null
          whatsapp_enviado: boolean | null
          whatsapp_respondido: boolean | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_email_enviado?: string | null
          data_email_respondido?: string | null
          data_reuniao?: string | null
          data_whatsapp_enviado?: string | null
          data_whatsapp_respondido?: string | null
          dores_identificadas?: string | null
          email: string
          email_enviado?: boolean | null
          email_respondido?: boolean | null
          empresa?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_cargo?: string | null
          linkedin_url?: string | null
          mensagem_original?: string | null
          motivo_score?: string | null
          nivel_maturidade_digital?: string | null
          nome: string
          oportunidades?: string | null
          origem?: string | null
          porte_empresa?: string | null
          prioridade_contato?: string | null
          resumo_empresa?: string | null
          reuniao_agendada?: boolean | null
          score?: number | null
          segmento?: string | null
          site_descricao?: string | null
          site_empresa?: string | null
          site_titulo?: string | null
          status?: string | null
          telefone?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_respondido?: boolean | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_email_enviado?: string | null
          data_email_respondido?: string | null
          data_reuniao?: string | null
          data_whatsapp_enviado?: string | null
          data_whatsapp_respondido?: string | null
          dores_identificadas?: string | null
          email?: string
          email_enviado?: boolean | null
          email_respondido?: boolean | null
          empresa?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_cargo?: string | null
          linkedin_url?: string | null
          mensagem_original?: string | null
          motivo_score?: string | null
          nivel_maturidade_digital?: string | null
          nome?: string
          oportunidades?: string | null
          origem?: string | null
          porte_empresa?: string | null
          prioridade_contato?: string | null
          resumo_empresa?: string | null
          reuniao_agendada?: boolean | null
          score?: number | null
          segmento?: string | null
          site_descricao?: string | null
          site_empresa?: string | null
          site_titulo?: string | null
          status?: string | null
          telefone?: string | null
          whatsapp_enviado?: boolean | null
          whatsapp_respondido?: boolean | null
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          contrato_id: string
          criado_em: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          id: string
          notificacao_enviada: boolean
          status: string
          valor: number
        }
        Insert: {
          contrato_id: string
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          id?: string
          notificacao_enviada?: boolean
          status?: string
          valor: number
        }
        Update: {
          contrato_id?: string
          criado_em?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          id?: string
          notificacao_enviada?: boolean
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      recorrencias: {
        Row: {
          ativo: boolean
          contrato_id: string
          criado_em: string
          dia_vencimento: number
          id: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          contrato_id: string
          criado_em?: string
          dia_vencimento?: number
          id?: string
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          contrato_id?: string
          criado_em?: string
          dia_vencimento?: number
          id?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "recorrencias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
