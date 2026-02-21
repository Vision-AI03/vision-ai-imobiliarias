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
