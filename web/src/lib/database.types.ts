
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "administradores": {
                  Row: {
                    "creado_en": string,"id_usuario": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"id_usuario": string
                  }
                  Update: {
                    "creado_en"?: string,"id_usuario"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ajustes_usuario": {
                  Row: {
                    "actualizado_en": string,"id_usuario": string,"tarifa_bs_kwh": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"id_usuario"?: string,"tarifa_bs_kwh"?: number
                  }
                  Update: {
                    "actualizado_en"?: string,"id_usuario"?: string,"tarifa_bs_kwh"?: number
                  }
                  Relationships: [
                    
                  ]
                },"alertas": {
                  Row: {
                    "corriente_a": number,"fecha_hora": string,"id_alerta": number,"id_medidor": number,"leida": boolean,"tipo": string,"umbral_a": number
                  }
                  ComputedFields: never
                  Insert: {
                    "corriente_a": number,"fecha_hora"?: string,"id_alerta"?: never,"id_medidor": number,"leida"?: boolean,"tipo"?: string,"umbral_a": number
                  }
                  Update: {
                    "corriente_a"?: number,"fecha_hora"?: string,"id_alerta"?: never,"id_medidor"?: number,"leida"?: boolean,"tipo"?: string,"umbral_a"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "alertas_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "alertas_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    }
                  ]
                },"aparatos_instalados": {
                  Row: {
                    "alerta_activa": boolean,"alias": string | null,"id_aparato": number,"id_catalogo": number,"id_medidor": number,"id_ubicacion": number | null,"margen_alerta_pct": number,"segundos_sostenido": number,"umbral_corriente_a": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alerta_activa"?: boolean,"alias"?: string | null,"id_aparato"?: never,"id_catalogo": number,"id_medidor": number,"id_ubicacion"?: number | null,"margen_alerta_pct"?: number,"segundos_sostenido"?: number,"umbral_corriente_a"?: number | null
                  }
                  Update: {
                    "alerta_activa"?: boolean,"alias"?: string | null,"id_aparato"?: never,"id_catalogo"?: number,"id_medidor"?: number,"id_ubicacion"?: number | null,"margen_alerta_pct"?: number,"segundos_sostenido"?: number,"umbral_corriente_a"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "aparatos_instalados_id_catalogo_fkey"
      columns: ["id_catalogo"]
isOneToOne: false
      referencedRelation: "catalogo_aparatos"
      referencedColumns: ["id_catalogo"]
    },{
      foreignKeyName: "aparatos_instalados_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: true
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "aparatos_instalados_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: true
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "aparatos_instalados_id_ubicacion_fkey"
      columns: ["id_ubicacion"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["id_ubicacion"]
    }
                  ]
                },"catalogo_aparatos": {
                  Row: {
                    "corriente_nominal_a": number | null,"es_global": boolean | null,"id_catalogo": number,"id_usuario": string | null,"marca": string | null,"modelo": string | null,"potencia_nominal_w": number,"tipo": string,"voltaje_nominal_v": number
                  }
                  ComputedFields: never
                  Insert: {
                    "corriente_nominal_a"?: never,"es_global"?: never,"id_catalogo"?: never,"id_usuario"?: string | null,"marca"?: string | null,"modelo"?: string | null,"potencia_nominal_w": number,"tipo": string,"voltaje_nominal_v"?: number
                  }
                  Update: {
                    "corriente_nominal_a"?: never,"es_global"?: never,"id_catalogo"?: never,"id_usuario"?: string | null,"marca"?: string | null,"modelo"?: string | null,"potencia_nominal_w"?: number,"tipo"?: string,"voltaje_nominal_v"?: number
                  }
                  Relationships: [
                    
                  ]
                },"codigos_vinculacion": {
                  Row: {
                    "alias": string | null,"codigo": string,"creado_en": string,"expira_en": string,"id_catalogo": number,"id_codigo": number,"id_medidor": number | null,"id_ubicacion": number | null,"id_usuario": string,"usado_en": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias"?: string | null,"codigo": string,"creado_en"?: string,"expira_en"?: string,"id_catalogo": number,"id_codigo"?: never,"id_medidor"?: number | null,"id_ubicacion"?: number | null,"id_usuario": string,"usado_en"?: string | null
                  }
                  Update: {
                    "alias"?: string | null,"codigo"?: string,"creado_en"?: string,"expira_en"?: string,"id_catalogo"?: number,"id_codigo"?: never,"id_medidor"?: number | null,"id_ubicacion"?: number | null,"id_usuario"?: string,"usado_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "codigos_vinculacion_id_catalogo_fkey"
      columns: ["id_catalogo"]
isOneToOne: false
      referencedRelation: "catalogo_aparatos"
      referencedColumns: ["id_catalogo"]
    },{
      foreignKeyName: "codigos_vinculacion_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "codigos_vinculacion_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "codigos_vinculacion_id_ubicacion_fkey"
      columns: ["id_ubicacion"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["id_ubicacion"]
    }
                  ]
                },"fallas_hardware": {
                  Row: {
                    "bias_v": number | null,"codigo": string,"fecha_hora": string,"id_falla": number,"id_medidor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bias_v"?: number | null,"codigo": string,"fecha_hora"?: string,"id_falla"?: never,"id_medidor": number
                  }
                  Update: {
                    "bias_v"?: number | null,"codigo"?: string,"fecha_hora"?: string,"id_falla"?: never,"id_medidor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fallas_hardware_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "fallas_hardware_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    }
                  ]
                },"lecturas_energia": {
                  Row: {
                    "corriente_a": number,"fecha_hora": string,"id_medidor": number
                  }
                  ComputedFields: never
                  Insert: {
                    "corriente_a": number,"fecha_hora"?: string,"id_medidor": number
                  }
                  Update: {
                    "corriente_a"?: number,"fecha_hora"?: string,"id_medidor"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lecturas_energia_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "lecturas_energia_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    }
                  ]
                },"lecturas_hora": {
                  Row: {
                    "corriente_max": number,"corriente_min": number,"corriente_prom": number,"hora": string,"id_medidor": number,"muestras": number
                  }
                  ComputedFields: never
                  Insert: {
                    "corriente_max": number,"corriente_min": number,"corriente_prom": number,"hora": string,"id_medidor": number,"muestras": number
                  }
                  Update: {
                    "corriente_max"?: number,"corriente_min"?: number,"corriente_prom"?: number,"hora"?: string,"id_medidor"?: number,"muestras"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "lecturas_hora_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "medidores_esp32"
      referencedColumns: ["id_medidor"]
    },{
      foreignKeyName: "lecturas_hora_id_medidor_fkey"
      columns: ["id_medidor"]
isOneToOne: false
      referencedRelation: "ultima_lectura"
      referencedColumns: ["id_medidor"]
    }
                  ]
                },"medidores_esp32": {
                  Row: {
                    "activo": boolean,"creado_en": string,"firmware_version": string | null,"id_medidor": number,"id_usuario": string,"mac_address": unknown,"nombre": string | null,"recalibrar_solicitado": boolean,"token_hash": string,"ultima_conexion": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"creado_en"?: string,"firmware_version"?: string | null,"id_medidor"?: never,"id_usuario": string,"mac_address": unknown,"nombre"?: string | null,"recalibrar_solicitado"?: boolean,"token_hash": string,"ultima_conexion"?: string | null
                  }
                  Update: {
                    "activo"?: boolean,"creado_en"?: string,"firmware_version"?: string | null,"id_medidor"?: never,"id_usuario"?: string,"mac_address"?: unknown,"nombre"?: string | null,"recalibrar_solicitado"?: boolean,"token_hash"?: string,"ultima_conexion"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_suscripciones": {
                  Row: {
                    "auth": string,"creado_en": string,"endpoint": string,"id_suscripcion": number,"id_usuario": string,"p256dh": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"creado_en"?: string,"endpoint": string,"id_suscripcion"?: never,"id_usuario": string,"p256dh": string,"user_agent"?: string | null
                  }
                  Update: {
                    "auth"?: string,"creado_en"?: string,"endpoint"?: string,"id_suscripcion"?: never,"id_usuario"?: string,"p256dh"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ubicaciones": {
                  Row: {
                    "id_ubicacion": number,"id_usuario": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id_ubicacion"?: never,"id_usuario": string,"nombre": string
                  }
                  Update: {
                    "id_ubicacion"?: never,"id_usuario"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "ultima_lectura": {
                  Row: {
                    "corriente_a": number,"fecha_hora": string,"id_medidor": number
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "es_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"evaluar_sobreconsumo":
{ Args: { "p_enfriamiento"?: string,"p_id_medidor": number }; Returns: Json
                           },
"generar_codigo_vinculacion":
{ Args: { "p_alias"?: string,"p_id_catalogo": number,"p_id_ubicacion"?: number }; Returns: {
              "codigo_generado": string,"vence_en": string
            }[]
                           },
"ingestar_lotes":
{ Args: { "p_falla"?: Json,"p_firmware"?: string,"p_lecturas": Json,"p_token_hash": string }; Returns: Json
                           },
"lecturas_serie":
{ Args: { "p_desde": string,"p_hasta": string,"p_id_medidor": number,"p_seg"?: number }; Returns: {
              "corriente_max": number,"corriente_min": number,"corriente_prom": number,"muestras": number,"t": string
            }[]
                           },
"purgar_lecturas":
{ Args: { "p_dias"?: number }; Returns: number
                           },
"resumir_lecturas_hora":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"vincular_medidor":
{ Args: { "p_codigo": string,"p_firmware": string,"p_mac": unknown,"p_token_hash": string }; Returns: number
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
