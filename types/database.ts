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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      competitions: {
        Row: {
          country: string | null
          created_at: string
          end_date: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          season: string
          short_name: string
          sport_id: number | null
          start_date: string
          type: Database["public"]["Enums"]["competition_type"]
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          season: string
          short_name: string
          sport_id?: number | null
          start_date: string
          type: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          season?: string
          short_name?: string
          sport_id?: number | null
          start_date?: string
          type?: Database["public"]["Enums"]["competition_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      data_health: {
        Row: {
          coverage_pct: number | null
          error_rate: number
          last_error_at: string | null
          last_ok_at: string | null
          latency_ms: number | null
          source: string
          updated_at: string
        }
        Insert: {
          coverage_pct?: number | null
          error_rate?: number
          last_error_at?: string | null
          last_ok_at?: string | null
          latency_ms?: number | null
          source: string
          updated_at?: string
        }
        Update: {
          coverage_pct?: number | null
          error_rate?: number
          last_error_at?: string | null
          last_ok_at?: string | null
          latency_ms?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_provenance: {
        Row: {
          confidence: number
          endpoint: string | null
          entity: string
          entity_id: string
          fetched_at: string
          field_scope: string
          id: string
          second_source: string | null
          source: string
          source_tier: number
          validated_at: string | null
          validation_status: string
        }
        Insert: {
          confidence?: number
          endpoint?: string | null
          entity: string
          entity_id: string
          fetched_at?: string
          field_scope?: string
          id?: string
          second_source?: string | null
          source: string
          source_tier?: number
          validated_at?: string | null
          validation_status?: string
        }
        Update: {
          confidence?: number
          endpoint?: string | null
          entity?: string
          entity_id?: string
          fetched_at?: string
          field_scope?: string
          id?: string
          second_source?: string | null
          source?: string
          source_tier?: number
          validated_at?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      data_quality_snapshots: {
        Row: {
          data_age_hours: Json | null
          fields_present: Json | null
          id: string
          match_id: string | null
          quality_score: number
          reliability_tier: string
          snapshot_at: string | null
          sources_used: string[] | null
        }
        Insert: {
          data_age_hours?: Json | null
          fields_present?: Json | null
          id?: string
          match_id?: string | null
          quality_score?: number
          reliability_tier?: string
          snapshot_at?: string | null
          sources_used?: string[] | null
        }
        Update: {
          data_age_hours?: Json | null
          fields_present?: Json | null
          id?: string
          match_id?: string | null
          quality_score?: number
          reliability_tier?: string
          snapshot_at?: string | null
          sources_used?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_snapshots_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      event_simulations: {
        Row: {
          cards_distribution: Json | null
          corners_distribution: Json | null
          created_at: string | null
          goal_distribution: Json | null
          id: string
          iterations: number
          match_id: string | null
          p50: Json | null
          p80: Json | null
          p95: Json | null
          simulation_run_id: string
        }
        Insert: {
          cards_distribution?: Json | null
          corners_distribution?: Json | null
          created_at?: string | null
          goal_distribution?: Json | null
          id?: string
          iterations?: number
          match_id?: string | null
          p50?: Json | null
          p80?: Json | null
          p95?: Json | null
          simulation_run_id?: string
        }
        Update: {
          cards_distribution?: Json | null
          corners_distribution?: Json | null
          created_at?: string | null
          goal_distribution?: Json | null
          id?: string
          iterations?: number
          match_id?: string | null
          p50?: Json | null
          p80?: Json | null
          p95?: Json | null
          simulation_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_simulations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_simulations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      exact_score_predictions: {
        Row: {
          away_score: number
          created_at: string
          home_score: number
          id: string
          prediction_id: string
          probability: number
          rank: number
        }
        Insert: {
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          prediction_id: string
          probability: number
          rank: number
        }
        Update: {
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          prediction_id?: string
          probability?: number
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "exact_score_predictions_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_standings: {
        Row: {
          drawn: number
          form: Database["public"]["Enums"]["form_result"][] | null
          goal_difference: number | null
          goals_against: number
          goals_for: number
          group_id: string
          id: string
          lost: number
          played: number
          points: number | null
          qualification_probability: number
          team_id: string
          top_spot_probability: number
          updated_at: string
          won: number
        }
        Insert: {
          drawn?: number
          form?: Database["public"]["Enums"]["form_result"][] | null
          goal_difference?: number | null
          goals_against?: number
          goals_for?: number
          group_id: string
          id?: string
          lost?: number
          played?: number
          points?: number | null
          qualification_probability?: number
          team_id: string
          top_spot_probability?: number
          updated_at?: string
          won?: number
        }
        Update: {
          drawn?: number
          form?: Database["public"]["Enums"]["form_result"][] | null
          goal_difference?: number | null
          goals_against?: number
          goals_for?: number
          group_id?: string
          id?: string
          lost?: number
          played?: number
          points?: number | null
          qualification_probability?: number
          team_id?: string
          top_spot_probability?: number
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_standings_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          letter: string
          name: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          letter: string
          name: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          letter?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          competition_id: string
          created_at: string
          description: string | null
          expected_return: string | null
          id: string
          impact_score: number
          injury_type: Database["public"]["Enums"]["injury_type"]
          is_active: boolean
          player_id: string
          reported_at: string
          team_id: string
          updated_at: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          description?: string | null
          expected_return?: string | null
          id?: string
          impact_score?: number
          injury_type: Database["public"]["Enums"]["injury_type"]
          is_active?: boolean
          player_id: string
          reported_at?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          description?: string | null
          expected_return?: string | null
          id?: string
          impact_score?: number
          injury_type?: Database["public"]["Enums"]["injury_type"]
          is_active?: boolean
          player_id?: string
          reported_at?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          done_at: string | null
          id: number
          kind: string
          last_error: string | null
          payload: Json
          run_after: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          done_at?: string | null
          id?: number
          kind: string
          last_error?: string | null
          payload?: Json
          run_after?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          done_at?: string | null
          id?: number
          kind?: string
          last_error?: string | null
          payload?: Json
          run_after?: string
          status?: string
        }
        Relationships: []
      }
      lineup_players: {
        Row: {
          grid_x: number
          grid_y: number
          id: string
          is_captain: boolean
          is_starter: boolean
          lineup_id: string
          player_id: string
          position: Database["public"]["Enums"]["player_position"]
          substituted_at: number | null
          substituted_by: string | null
        }
        Insert: {
          grid_x: number
          grid_y: number
          id?: string
          is_captain?: boolean
          is_starter?: boolean
          lineup_id: string
          player_id: string
          position: Database["public"]["Enums"]["player_position"]
          substituted_at?: number | null
          substituted_by?: string | null
        }
        Update: {
          grid_x?: number
          grid_y?: number
          id?: string
          is_captain?: boolean
          is_starter?: boolean
          lineup_id?: string
          player_id?: string
          position?: Database["public"]["Enums"]["player_position"]
          substituted_at?: number | null
          substituted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_substituted_by_fkey"
            columns: ["substituted_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          formation: string
          id: string
          is_confirmed: boolean
          match_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          formation?: string
          id?: string
          is_confirmed?: boolean
          match_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          formation?: string
          id?: string
          is_confirmed?: boolean
          match_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      market_movements: {
        Row: {
          bookmaker: string
          detected_at: string | null
          id: string
          is_significant: boolean | null
          market: string
          match_id: string | null
          odds_after: number
          odds_before: number
          prob_shift_pct: number
        }
        Insert: {
          bookmaker: string
          detected_at?: string | null
          id?: string
          is_significant?: boolean | null
          market: string
          match_id?: string | null
          odds_after: number
          odds_before: number
          prob_shift_pct: number
        }
        Update: {
          bookmaker?: string
          detected_at?: string | null
          id?: string
          is_significant?: boolean | null
          market?: string
          match_id?: string | null
          odds_after?: number
          odds_before?: number
          prob_shift_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_movements_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_movements_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_statistics: {
        Row: {
          big_chances: number | null
          big_chances_missed: number | null
          corners: number | null
          created_at: string
          fouls: number | null
          id: string
          match_id: string
          offsides: number | null
          pass_accuracy: number | null
          passes: number | null
          possession: number | null
          red_cards: number | null
          saves: number | null
          shots: number | null
          shots_on_target: number | null
          source: string
          team_id: string
          xg: number | null
          xga: number | null
          yellow_cards: number | null
        }
        Insert: {
          big_chances?: number | null
          big_chances_missed?: number | null
          corners?: number | null
          created_at?: string
          fouls?: number | null
          id?: string
          match_id: string
          offsides?: number | null
          pass_accuracy?: number | null
          passes?: number | null
          possession?: number | null
          red_cards?: number | null
          saves?: number | null
          shots?: number | null
          shots_on_target?: number | null
          source?: string
          team_id: string
          xg?: number | null
          xga?: number | null
          yellow_cards?: number | null
        }
        Update: {
          big_chances?: number | null
          big_chances_missed?: number | null
          corners?: number | null
          created_at?: string
          fouls?: number | null
          id?: string
          match_id?: string
          offsides?: number | null
          pass_accuracy?: number | null
          passes?: number | null
          possession?: number | null
          red_cards?: number | null
          saves?: number | null
          shots?: number | null
          shots_on_target?: number | null
          source?: string
          team_id?: string
          xg?: number | null
          xga?: number | null
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_statistics_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_statistics_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          api_football_id: number | null
          attendance: number | null
          away_penalties: number | null
          away_rest_days: number | null
          away_score: number | null
          away_score_ht: number | null
          away_team_id: string
          city: string
          competition_id: string
          country: string
          created_at: string
          group_id: string | null
          home_penalties: number | null
          home_rest_days: number | null
          home_score: number | null
          home_score_ht: number | null
          home_team_id: string
          id: string
          kickoff_time: string
          match_number: number
          phase: Database["public"]["Enums"]["match_phase"]
          referee: string | null
          round: number | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue: string
          weather_condition: string | null
          weather_temp_celsius: number | null
        }
        Insert: {
          api_football_id?: number | null
          attendance?: number | null
          away_penalties?: number | null
          away_rest_days?: number | null
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id: string
          city: string
          competition_id: string
          country: string
          created_at?: string
          group_id?: string | null
          home_penalties?: number | null
          home_rest_days?: number | null
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id: string
          id?: string
          kickoff_time: string
          match_number: number
          phase: Database["public"]["Enums"]["match_phase"]
          referee?: string | null
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue: string
          weather_condition?: string | null
          weather_temp_celsius?: number | null
        }
        Update: {
          api_football_id?: number | null
          attendance?: number | null
          away_penalties?: number | null
          away_rest_days?: number | null
          away_score?: number | null
          away_score_ht?: number | null
          away_team_id?: string
          city?: string
          competition_id?: string
          country?: string
          created_at?: string
          group_id?: string | null
          home_penalties?: number | null
          home_rest_days?: number | null
          home_score?: number | null
          home_score_ht?: number | null
          home_team_id?: string
          id?: string
          kickoff_time?: string
          match_number?: number
          phase?: Database["public"]["Enums"]["match_phase"]
          referee?: string | null
          round?: number | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string
          weather_condition?: string | null
          weather_temp_celsius?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      model_registry: {
        Row: {
          accuracy_1x2: number | null
          brier_score: number | null
          correct_predictions: number | null
          created_at: string | null
          id: string
          last_evaluated_at: string | null
          mae_goals: number | null
          model_name: string
          predictions_evaluated: number | null
          version: string
        }
        Insert: {
          accuracy_1x2?: number | null
          brier_score?: number | null
          correct_predictions?: number | null
          created_at?: string | null
          id?: string
          last_evaluated_at?: string | null
          mae_goals?: number | null
          model_name: string
          predictions_evaluated?: number | null
          version?: string
        }
        Update: {
          accuracy_1x2?: number | null
          brier_score?: number | null
          correct_predictions?: number | null
          created_at?: string | null
          id?: string
          last_evaluated_at?: string | null
          mae_goals?: number | null
          model_name?: string
          predictions_evaluated?: number | null
          version?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          match_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          match_id?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          match_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      odds: {
        Row: {
          bookmaker: string
          created_at: string
          id: string
          implied_probability: number
          margin: number | null
          market: Database["public"]["Enums"]["odds_market"]
          match_id: string
          odds_value: number
          recorded_at: string
          source: string | null
        }
        Insert: {
          bookmaker: string
          created_at?: string
          id?: string
          implied_probability: number
          margin?: number | null
          market: Database["public"]["Enums"]["odds_market"]
          match_id: string
          odds_value: number
          recorded_at?: string
          source?: string | null
        }
        Update: {
          bookmaker?: string
          created_at?: string
          id?: string
          implied_probability?: number
          margin?: number | null
          market?: Database["public"]["Enums"]["odds_market"]
          match_id?: string
          odds_value?: number
          recorded_at?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      player_statistics: {
        Row: {
          assists: number
          avg_rating: number
          competition_id: string
          dribbles_completed: number
          form_score: number
          goals: number
          id: string
          interceptions: number
          key_passes: number
          matches_played: number
          minutes_played: number
          physical_condition: number
          player_id: string
          red_cards: number
          shots: number
          shots_on_target: number
          tackles: number
          updated_at: string
          yellow_cards: number
        }
        Insert: {
          assists?: number
          avg_rating?: number
          competition_id: string
          dribbles_completed?: number
          form_score?: number
          goals?: number
          id?: string
          interceptions?: number
          key_passes?: number
          matches_played?: number
          minutes_played?: number
          physical_condition?: number
          player_id: string
          red_cards?: number
          shots?: number
          shots_on_target?: number
          tackles?: number
          updated_at?: string
          yellow_cards?: number
        }
        Update: {
          assists?: number
          avg_rating?: number
          competition_id?: string
          dribbles_completed?: number
          form_score?: number
          goals?: number
          id?: string
          interceptions?: number
          key_passes?: number
          matches_played?: number
          minutes_played?: number
          physical_condition?: number
          player_id?: string
          red_cards?: number
          shots?: number
          shots_on_target?: number
          tackles?: number
          updated_at?: string
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_statistics_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_statistics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          club_name: string | null
          created_at: string
          date_of_birth: string
          height_cm: number | null
          id: string
          market_value_euros: number | null
          name: string
          nationality: string
          number: number
          photo_url: string | null
          position: Database["public"]["Enums"]["player_position"]
          short_name: string
          status: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          club_name?: string | null
          created_at?: string
          date_of_birth: string
          height_cm?: number | null
          id?: string
          market_value_euros?: number | null
          name: string
          nationality: string
          number: number
          photo_url?: string | null
          position: Database["public"]["Enums"]["player_position"]
          short_name: string
          status?: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          club_name?: string | null
          created_at?: string
          date_of_birth?: string
          height_cm?: number | null
          id?: string
          market_value_euros?: number | null
          name?: string
          nationality?: string
          number?: number
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"]
          short_name?: string
          status?: Database["public"]["Enums"]["player_status"]
          team_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_audit_log: {
        Row: {
          created_at: string | null
          data_quality: Json | null
          ensemble_weights: Json | null
          id: string
          match_id: string | null
          model_results: Json | null
          prediction_id: string | null
          risk_assessment: Json | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string | null
          data_quality?: Json | null
          ensemble_weights?: Json | null
          id?: string
          match_id?: string | null
          model_results?: Json | null
          prediction_id?: string | null
          risk_assessment?: Json | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string | null
          data_quality?: Json | null
          ensemble_weights?: Json | null
          id?: string
          match_id?: string | null
          model_results?: Json | null
          prediction_id?: string | null
          risk_assessment?: Json | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_audit_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_audit_log_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_audit_log_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_history: {
        Row: {
          away_win_probability: number
          confidence_score: number
          created_at: string
          draw_probability: number
          home_win_probability: number
          id: string
          match_id: string
          prediction_id: string
          snapshot_at: string
          trigger: Database["public"]["Enums"]["simulation_trigger"]
        }
        Insert: {
          away_win_probability: number
          confidence_score: number
          created_at?: string
          draw_probability: number
          home_win_probability: number
          id?: string
          match_id: string
          prediction_id: string
          snapshot_at?: string
          trigger?: Database["public"]["Enums"]["simulation_trigger"]
        }
        Update: {
          away_win_probability?: number
          confidence_score?: number
          created_at?: string
          draw_probability?: number
          home_win_probability?: number
          id?: string
          match_id?: string
          prediction_id?: string
          snapshot_at?: string
          trigger?: Database["public"]["Enums"]["simulation_trigger"]
        }
        Relationships: [
          {
            foreignKeyName: "prediction_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_history_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          actual_outcome: string | null
          away_win_probability: number
          confidence_level: number
          confidence_score: number
          created_at: string
          data_age_hours: number | null
          data_quality_score: number | null
          draw_probability: number
          elo_weight: number
          form_weight: number
          home_win_probability: number
          id: string
          is_published: boolean
          last_data_sources: string[] | null
          market_weight: number
          match_id: string
          model_breakdown: Json | null
          model_version: string
          news_weight: number
          predicted_away_score: number
          predicted_home_score: number
          updated_at: string
          was_correct: boolean | null
          xg_weight: number
        }
        Insert: {
          actual_outcome?: string | null
          away_win_probability: number
          confidence_level: number
          confidence_score: number
          created_at?: string
          data_age_hours?: number | null
          data_quality_score?: number | null
          draw_probability: number
          elo_weight?: number
          form_weight?: number
          home_win_probability: number
          id?: string
          is_published?: boolean
          last_data_sources?: string[] | null
          market_weight?: number
          match_id: string
          model_breakdown?: Json | null
          model_version?: string
          news_weight?: number
          predicted_away_score?: number
          predicted_home_score?: number
          updated_at?: string
          was_correct?: boolean | null
          xg_weight?: number
        }
        Update: {
          actual_outcome?: string | null
          away_win_probability?: number
          confidence_level?: number
          confidence_score?: number
          created_at?: string
          data_age_hours?: number | null
          data_quality_score?: number | null
          draw_probability?: number
          elo_weight?: number
          form_weight?: number
          home_win_probability?: number
          id?: string
          is_published?: boolean
          last_data_sources?: string[] | null
          market_weight?: number
          match_id?: string
          model_breakdown?: Json | null
          model_version?: string
          news_weight?: number
          predicted_away_score?: number
          predicted_home_score?: number
          updated_at?: string
          was_correct?: boolean | null
          xg_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          competition_id: string
          id: string
          is_active: boolean
          label: string
          year_end: number
          year_start: number
        }
        Insert: {
          competition_id: string
          id?: string
          is_active?: boolean
          label: string
          year_end: number
          year_start: number
        }
        Update: {
          competition_id?: string
          id?: string
          is_active?: boolean
          label?: string
          year_end?: number
          year_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_results: {
        Row: {
          away_win_probability: number
          confidence_score: number
          created_at: string
          delta_vs_base: Json
          draw_probability: number
          home_win_probability: number
          id: string
          input: Json
          match_id: string
          predicted_away_score: number
          predicted_home_score: number
          scenario_name: string | null
          top_scorelines: Json
          user_id: string
        }
        Insert: {
          away_win_probability: number
          confidence_score: number
          created_at?: string
          delta_vs_base?: Json
          draw_probability: number
          home_win_probability: number
          id?: string
          input: Json
          match_id: string
          predicted_away_score: number
          predicted_home_score: number
          scenario_name?: string | null
          top_scorelines?: Json
          user_id: string
        }
        Update: {
          away_win_probability?: number
          confidence_score?: number
          created_at?: string
          delta_vs_base?: Json
          draw_probability?: number
          home_win_probability?: number
          id?: string
          input?: Json
          match_id?: string
          predicted_away_score?: number
          predicted_home_score?: number
          scenario_name?: string | null
          top_scorelines?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: number
          name: string
          slug: string
        }
        Update: {
          id?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          records_failed: number
          records_processed: number
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_failed?: number
          records_processed?: number
          source: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          records_failed?: number
          records_processed?: number
          source?: string
          status?: string
        }
        Relationships: []
      }
      team_statistics: {
        Row: {
          avg_corners: number
          avg_goals_conceded: number
          avg_goals_scored: number
          avg_possession: number
          avg_red_cards: number
          avg_shots: number
          avg_shots_on_target: number
          avg_xg: number
          avg_xga: number
          avg_yellow_cards: number
          clean_sheets: number
          competition_id: string
          form: Database["public"]["Enums"]["form_result"][] | null
          goals_conceded: number
          goals_scored: number
          id: string
          matches_played: number
          team_id: string
          updated_at: string
        }
        Insert: {
          avg_corners?: number
          avg_goals_conceded?: number
          avg_goals_scored?: number
          avg_possession?: number
          avg_red_cards?: number
          avg_shots?: number
          avg_shots_on_target?: number
          avg_xg?: number
          avg_xga?: number
          avg_yellow_cards?: number
          clean_sheets?: number
          competition_id: string
          form?: Database["public"]["Enums"]["form_result"][] | null
          goals_conceded?: number
          goals_scored?: number
          id?: string
          matches_played?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          avg_corners?: number
          avg_goals_conceded?: number
          avg_goals_scored?: number
          avg_possession?: number
          avg_red_cards?: number
          avg_shots?: number
          avg_shots_on_target?: number
          avg_xg?: number
          avg_xga?: number
          avg_yellow_cards?: number
          clean_sheets?: number
          competition_id?: string
          form?: Database["public"]["Enums"]["form_result"][] | null
          goals_conceded?: number
          goals_scored?: number
          id?: string
          matches_played?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_statistics_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_statistics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          api_football_id: number | null
          coach: string | null
          code: string
          competition_id: string
          confederation: Database["public"]["Enums"]["confederation"]
          created_at: string
          elo_rating: number
          fifa_ranking: number
          flag_url: string | null
          group_id: string | null
          id: string
          logo_url: string | null
          name: string
          short_name: string
          updated_at: string
        }
        Insert: {
          api_football_id?: number | null
          coach?: string | null
          code: string
          competition_id: string
          confederation: Database["public"]["Enums"]["confederation"]
          created_at?: string
          elo_rating?: number
          fifa_ranking?: number
          flag_url?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          name: string
          short_name: string
          updated_at?: string
        }
        Update: {
          api_football_id?: number | null
          coach?: string | null
          code?: string
          competition_id?: string
          confederation?: Database["public"]["Enums"]["confederation"]
          created_at?: string
          elo_rating?: number
          fifa_ranking?: number
          flag_url?: string | null
          group_id?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_predictions: {
        Row: {
          competition_id: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          model_version: string | null
          prediction_type: string
          probability: number
          rank: number | null
          updated_at: string | null
        }
        Insert: {
          competition_id?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          model_version?: string | null
          prediction_type: string
          probability: number
          rank?: number | null
          updated_at?: string | null
        }
        Update: {
          competition_id?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          model_version?: string | null
          prediction_type?: string
          probability?: number
          rank?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_predictions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_simulations: {
        Row: {
          competition_id: string
          created_at: string
          final_prob: number
          group_stage_advance_prob: number
          id: string
          quarter_final_prob: number
          round_of_16_prob: number
          semi_final_prob: number
          simulation_run_id: string
          team_id: string
          winner_prob: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          final_prob?: number
          group_stage_advance_prob?: number
          id?: string
          quarter_final_prob?: number
          round_of_16_prob?: number
          semi_final_prob?: number
          simulation_run_id: string
          team_id: string
          winner_prob?: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          final_prob?: number
          group_stage_advance_prob?: number
          id?: string
          quarter_final_prob?: number
          round_of_16_prob?: number
          semi_final_prob?: number
          simulation_run_id?: string
          team_id?: string
          winner_prob?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournament_simulations_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_simulations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_simulations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferences: Json | null
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      value_bets: {
        Row: {
          ai_factors: Json | null
          ai_justification: string | null
          bookmaker: string
          created_at: string
          edge: number
          expected_value: number
          grade: Database["public"]["Enums"]["value_bet_grade"]
          id: string
          implied_probability: number
          is_active: boolean
          market: Database["public"]["Enums"]["odds_market"]
          match_id: string
          model_probability: number
          odds_value: number
          prediction_id: string
          result: Database["public"]["Enums"]["bet_result"]
          stake_suggestion_percent: number | null
          updated_at: string
        }
        Insert: {
          ai_factors?: Json | null
          ai_justification?: string | null
          bookmaker: string
          created_at?: string
          edge: number
          expected_value: number
          grade: Database["public"]["Enums"]["value_bet_grade"]
          id?: string
          implied_probability: number
          is_active?: boolean
          market: Database["public"]["Enums"]["odds_market"]
          match_id: string
          model_probability: number
          odds_value: number
          prediction_id: string
          result?: Database["public"]["Enums"]["bet_result"]
          stake_suggestion_percent?: number | null
          updated_at?: string
        }
        Update: {
          ai_factors?: Json | null
          ai_justification?: string | null
          bookmaker?: string
          created_at?: string
          edge?: number
          expected_value?: number
          grade?: Database["public"]["Enums"]["value_bet_grade"]
          id?: string
          implied_probability?: number
          is_active?: boolean
          market?: Database["public"]["Enums"]["odds_market"]
          match_id?: string
          model_probability?: number
          odds_value?: number
          prediction_id?: string
          result?: Database["public"]["Enums"]["bet_result"]
          stake_suggestion_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_bets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_bets_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_kpis: {
        Row: {
          active_injuries: number | null
          active_picks: number | null
          analyzed_matches: number | null
          correct_predictions: number | null
          resolved_predictions: number | null
          total_matches: number | null
          value_bets_detected: number | null
          value_bets_won: number | null
        }
        Relationships: []
      }
      events_v: {
        Row: {
          city: string | null
          competition_id: string | null
          country: string | null
          id: string | null
          participant_a: string | null
          participant_b: string | null
          phase: string | null
          score_a: number | null
          score_b: number | null
          score_detail: Json | null
          sport: string | null
          starts_at: string | null
          status: string | null
          venue: string | null
        }
        Insert: {
          city?: string | null
          competition_id?: string | null
          country?: string | null
          id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          phase?: never
          score_a?: number | null
          score_b?: number | null
          score_detail?: never
          sport?: never
          starts_at?: string | null
          status?: never
          venue?: string | null
        }
        Update: {
          city?: string | null
          competition_id?: string | null
          country?: string | null
          id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          phase?: never
          score_a?: number | null
          score_b?: number | null
          score_detail?: never
          sport?: never
          starts_at?: string | null
          status?: never
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "participants_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_market_consensus: {
        Row: {
          avg_implied: number | null
          market: Database["public"]["Enums"]["odds_market"] | null
          match_id: string | null
          samples: number | null
        }
        Relationships: [
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "events_v"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      participants_v: {
        Row: {
          code: string | null
          competition_id: string | null
          country: string | null
          elo: number | null
          id: string | null
          kind: string | null
          meta: Json | null
          name: string | null
          sport: string | null
        }
        Insert: {
          code?: string | null
          competition_id?: string | null
          country?: string | null
          elo?: number | null
          id?: string | null
          kind?: never
          meta?: never
          name?: string | null
          sport?: never
        }
        Update: {
          code?: string | null
          competition_id?: string | null
          country?: string | null
          elo?: number | null
          id?: string | null
          kind?: never
          meta?: never
          name?: string | null
          sport?: never
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      actual_outcome_from_score: {
        Args: { p_away_score: number; p_home_score: number }
        Returns: string
      }
      backfill_missing_match_stats: { Args: never; Returns: number }
      predicted_outcome_1x2: {
        Args: { p_away: number; p_draw: number; p_home: number }
        Returns: string
      }
      recalculate_group_standings: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      refresh_team_statistics: { Args: never; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      wc_form_score: {
        Args: { f: Database["public"]["Enums"]["form_result"][] }
        Returns: number
      }
    }
    Enums: {
      bet_result: "won" | "lost" | "void" | "pending"
      competition_type:
        | "world_cup"
        | "champions_league"
        | "copa_america"
        | "euro"
        | "league"
      confederation: "UEFA" | "CONMEBOL" | "CAF" | "AFC" | "CONCACAF" | "OFC"
      form_result: "W" | "D" | "L"
      injury_type:
        | "muscular"
        | "ligament"
        | "fracture"
        | "illness"
        | "suspension"
        | "other"
      match_phase:
        | "group"
        | "round_of_16"
        | "quarter_final"
        | "semi_final"
        | "third_place"
        | "final"
        | "round_of_32"
        | "league"
      match_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "cancelled"
      odds_market:
        | "home_win"
        | "draw"
        | "away_win"
        | "over_0_5"
        | "over_1_5"
        | "over_2_5"
        | "over_3_5"
        | "btts_yes"
        | "btts_no"
        | "clean_sheet_home"
        | "clean_sheet_away"
        | "dc_1x"
        | "dc_x2"
        | "corners_8_5"
        | "corners_9_5"
        | "corners_10_5"
        | "cards_2_5"
        | "cards_3_5"
        | "cards_4_5"
        | "shots_ot_5_5"
        | "shots_ot_7_5"
      player_position:
        | "GK"
        | "CB"
        | "LB"
        | "RB"
        | "CDM"
        | "CM"
        | "CAM"
        | "LW"
        | "RW"
        | "ST"
        | "CF"
      player_status: "available" | "doubt" | "injured" | "suspended"
      simulation_trigger:
        | "lineup_update"
        | "injury_update"
        | "odds_movement"
        | "manual"
        | "scheduled"
      value_bet_grade: "high" | "medium" | "low" | "none"
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
    Enums: {
      bet_result: ["won", "lost", "void", "pending"],
      competition_type: [
        "world_cup",
        "champions_league",
        "copa_america",
        "euro",
        "league",
      ],
      confederation: ["UEFA", "CONMEBOL", "CAF", "AFC", "CONCACAF", "OFC"],
      form_result: ["W", "D", "L"],
      injury_type: [
        "muscular",
        "ligament",
        "fracture",
        "illness",
        "suspension",
        "other",
      ],
      match_phase: [
        "group",
        "round_of_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
        "round_of_32",
        "league",
      ],
      match_status: ["scheduled", "live", "finished", "postponed", "cancelled"],
      odds_market: [
        "home_win",
        "draw",
        "away_win",
        "over_0_5",
        "over_1_5",
        "over_2_5",
        "over_3_5",
        "btts_yes",
        "btts_no",
        "clean_sheet_home",
        "clean_sheet_away",
        "dc_1x",
        "dc_x2",
        "corners_8_5",
        "corners_9_5",
        "corners_10_5",
        "cards_2_5",
        "cards_3_5",
        "cards_4_5",
        "shots_ot_5_5",
        "shots_ot_7_5",
      ],
      player_position: [
        "GK",
        "CB",
        "LB",
        "RB",
        "CDM",
        "CM",
        "CAM",
        "LW",
        "RW",
        "ST",
        "CF",
      ],
      player_status: ["available", "doubt", "injured", "suspended"],
      simulation_trigger: [
        "lineup_update",
        "injury_update",
        "odds_movement",
        "manual",
        "scheduled",
      ],
      value_bet_grade: ["high", "medium", "low", "none"],
    },
  },
} as const
