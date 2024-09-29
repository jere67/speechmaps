export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      reports: {
        Row: {
          id: string;
          user_id: string | null;
          description: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          description?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string | null;
        };
      };
      // Define other tables here if needed
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
