// Tipado de la base de datos Supabase.
// Versión simplificada — para tipado estricto completo, generar con:
//   npx supabase gen types typescript --project-id <id> > types/database.ts
export type Database = {
  public: {
    Tables: Record<string, {
      Row: Record<string, any>
      Insert: Record<string, any>
      Update: Record<string, any>
    }>
    Views: Record<string, { Row: Record<string, any> }>
    Functions: Record<string, any>
    Enums: Record<string, string>
  }
}
