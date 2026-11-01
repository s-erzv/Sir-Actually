export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ManuscriptStage = "proposal" | "skripsi" | "jurnal";

export type ClaimKind =
  | "problem"
  | "gap"
  | "objective"
  | "rq"
  | "method"
  | "finding"
  | "limitation"
  | "conclusion";

export type VerificationStatus =
  | "unchecked"
  | "verified"
  | "not_found"
  | "mismatch"
  | "needs_review";

export interface Completeness {
  complete: boolean;
  missing: string[];
  warnings: string[];
  sections: Record<string, boolean>;
  referenceCount: number;
  minReferences: number;
  minReferencesSource: "user" | "default";
  checkedAt: string;
}

type WithRelationships<T> = {
  [K in keyof T]: T[K] & { Relationships: [] };
};

export interface Database {
  public: {
    Tables: WithRelationships<{
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          display_name?: string | null;
        };
      };
      manuscripts: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          field: string | null;
          language: "id" | "en";
          stage: ManuscriptStage;
          min_references: number | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          field?: string | null;
          language?: "id" | "en";
          stage: ManuscriptStage;
          min_references?: number | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          title?: string;
          field?: string | null;
          language?: "id" | "en";
          stage?: ManuscriptStage;
          min_references?: number | null;
          deleted_at?: string | null;
        };
      };
      research_maps: {
        Row: {
          id: string;
          manuscript_id: string;
          version: number;
          status: "draft" | "confirmed";
          source_text: string;
          completeness: Completeness | null;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          version: number;
          status?: "draft" | "confirmed";
          source_text: string;
          completeness?: Completeness | null;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Update: {
          status?: "draft" | "confirmed";
          completeness?: Completeness | null;
          confirmed_at?: string | null;
        };
      };
      claims: {
        Row: {
          id: string;
          research_map_id: string;
          kind: ClaimKind;
          text: string;
          source_quote: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          research_map_id: string;
          kind: ClaimKind;
          text: string;
          source_quote?: string | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          kind?: ClaimKind;
          text?: string;
          source_quote?: string | null;
          position?: number;
        };
      };
      citations: {
        Row: {
          id: string;
          research_map_id: string;
          raw_text: string;
          parsed: Json | null;
          verification_status: VerificationStatus;
          matched_work: Json | null;
          is_injected: boolean;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          research_map_id: string;
          raw_text: string;
          parsed?: Json | null;
          verification_status?: VerificationStatus;
          matched_work?: Json | null;
          is_injected?: boolean;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          raw_text?: string;
          parsed?: Json | null;
          verification_status?: VerificationStatus;
          matched_work?: Json | null;
          verified_at?: string | null;
        };
      };
      claim_citations: {
        Row: {
          claim_id: string;
          citation_id: string;
        };
        Insert: {
          claim_id: string;
          citation_id: string;
        };
        Update: {
          claim_id?: string;
          citation_id?: string;
        };
      };
      manuscript_chunks: {
        Row: {
          id: string;
          manuscript_id: string;
          version: number;
          chunk_index: number;
          section_label: string | null;
          char_start: number;
          char_end: number;
          text: string;
          embedding: number[] | null;
          embedding_model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          version: number;
          chunk_index: number;
          section_label?: string | null;
          char_start: number;
          char_end: number;
          text: string;
          embedding?: number[] | null;
          embedding_model?: string | null;
          created_at?: string;
        };
        Update: {
          embedding?: number[] | null;
          embedding_model?: string | null;
        };
      };
      weakness_types: {
        Row: {
          slug: string;
          dimension: string;
          detector: "code" | "llm";
          uses_retrieval: boolean;
          default_severity: number;
          attack_types: string[];
          version: string;
          description: string;
        };
        Insert: never;
        Update: never;
      };
      bosses: {
        Row: {
          slug: string;
          name: string;
          floor_order: number;
          dimension: string | null;
          base_hp: number | null;
          rubric_id: string | null;
          sprite_key: string | null;
        };
        Insert: never;
        Update: never;
      };
      findings: {
        Row: {
          id: string;
          research_map_id: string;
          weakness_type: string;
          claim_id: string | null;
          citation_id: string | null;
          severity: number;
          severity_source: "default" | "llm" | "human";
          centrality: number;
          confidence: number;
          detector: "code" | "llm";
          evidence_quote: string;
          evidence_chunk_ids: string[];
          rank: number | null;
          status:
            | "untested"
            | "defended"
            | "conceded"
            | "disputed"
            | "needs_review";
          dispute_note: string | null;
          version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          research_map_id: string;
          weakness_type: string;
          claim_id?: string | null;
          citation_id?: string | null;
          severity: number;
          severity_source?: "default" | "llm" | "human";
          centrality: number;
          confidence: number;
          detector: "code" | "llm";
          evidence_quote: string;
          evidence_chunk_ids?: string[];
          rank?: number | null;
          status?:
            | "untested"
            | "defended"
            | "conceded"
            | "disputed"
            | "needs_review";
          dispute_note?: string | null;
          version: string;
          created_at?: string;
        };
        Update: {
          rank?: number | null;
          status?:
            | "untested"
            | "defended"
            | "conceded"
            | "disputed"
            | "needs_review";
          dispute_note?: string | null;
        };
      };
      recon_jobs: {
        Row: {
          id: string;
          research_map_id: string;
          status: "queued" | "running" | "done" | "failed";
          step: string | null;
          steps_done: number;
          steps_total: number | null;
          cursor: Json;
          timings: Json;
          discarded: Json;
          error: string | null;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          research_map_id: string;
          status?: "queued" | "running" | "done" | "failed";
          step?: string | null;
          steps_done?: number;
          steps_total?: number | null;
          cursor?: Json;
          timings?: Json;
          discarded?: Json;
          error?: string | null;
          created_at?: string;
          started_at?: string | null;
          finished_at?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: "queued" | "running" | "done" | "failed";
          step?: string | null;
          steps_done?: number;
          steps_total?: number | null;
          cursor?: Json;
          timings?: Json;
          discarded?: Json;
          error?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          updated_at?: string;
        };
      };
      runs: {
        Row: {
          id: string;
          research_map_id: string;
          examiner_style: "strict" | "detail" | "friendly";
          status: "active" | "finished" | "closed_revised";
          previous_run_id: string | null;
          hearts_left: number;
          rubric_version: string;
          model_version: string;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          research_map_id: string;
          examiner_style: "strict" | "detail" | "friendly";
          status?: "active" | "finished" | "closed_revised";
          previous_run_id?: string | null;
          hearts_left: number;
          rubric_version: string;
          model_version: string;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          status?: "active" | "finished" | "closed_revised";
          hearts_left?: number;
          finished_at?: string | null;
        };
      };
      encounters: {
        Row: {
          id: string;
          run_id: string;
          boss_slug: string;
          finding_id: string | null;
          is_boss: boolean;
          floor_order: number;
          room_order: number;
          status:
            | "pending"
            | "active"
            | "won"
            | "conceded"
            | "disputed"
            | "lost"
            | "retried";
          hp_start: number | null;
          hp_end: number | null;
          questions_asked: number;
          advice: Json | null;
          advice_prompt_version: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          boss_slug: string;
          finding_id?: string | null;
          is_boss?: boolean;
          floor_order: number;
          room_order: number;
          status?:
            | "pending"
            | "active"
            | "won"
            | "conceded"
            | "disputed"
            | "lost"
            | "retried";
          hp_start?: number | null;
          hp_end?: number | null;
          questions_asked?: number;
          advice?: Json | null;
          advice_prompt_version?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          status?:
            | "pending"
            | "active"
            | "won"
            | "conceded"
            | "disputed"
            | "lost"
            | "retried";
          hp_end?: number | null;
          questions_asked?: number;
          advice?: Json | null;
          resolved_at?: string | null;
        };
      };
      turns: {
        Row: {
          id: string;
          encounter_id: string;
          seq: number;
          role: "boss" | "player";
          text: string;
          target_claim_id: string | null;
          attack_type: string | null;
          question_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          encounter_id: string;
          seq: number;
          role: "boss" | "player";
          text: string;
          target_claim_id?: string | null;
          attack_type?: string | null;
          question_hash?: string | null;
          created_at?: string;
        };
        Update: {
          text?: string;
          attack_type?: string | null;
          question_hash?: string | null;
        };
      };
      evaluations: {
        Row: {
          id: string;
          turn_id: string;
          rubric_id: string;
          scores: Json;
          evidence_quotes: Json;
          score_total: number;
          score_max: number;
          damage: number;
          heart_lost: boolean;
          missing: string | null;
          rule_caps: Json;
          raw_judge_output: Json | null;
          rationale: string | null;
          judge_model: string;
          prompt_version: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          turn_id: string;
          rubric_id: string;
          scores: Json;
          evidence_quotes?: Json;
          score_total: number;
          score_max: number;
          damage: number;
          heart_lost?: boolean;
          missing?: string | null;
          rule_caps?: Json;
          raw_judge_output?: Json | null;
          rationale?: string | null;
          judge_model: string;
          prompt_version: string;
          created_at?: string;
        };
        Update: {
          scores?: Json;
          score_total?: number;
          damage?: number;
          heart_lost?: boolean;
          missing?: string | null;
          rule_caps?: Json;
        };
      };
      ghost_checks: {
        Row: {
          id: string;
          run_id: string;
          citation_id: string;
          flagged_citation_ids: string[];
          hit: boolean;
          duration_ms: number | null;
          flagged_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          citation_id: string;
          flagged_citation_ids?: string[];
          hit: boolean;
          duration_ms?: number | null;
          flagged_at?: string;
        };
        Update: never;
      };
      reports: {
        Row: {
          id: string;
          run_id: string;
          readiness: Json;
          weak_links: Json;
          comparison: Json | null;
          untested: Json;
          prompt_version: string | null;
          model_version: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          readiness: Json;
          weak_links: Json;
          comparison?: Json | null;
          untested?: Json;
          prompt_version?: string | null;
          model_version?: string | null;
          generated_at?: string;
        };
        Update: {
          readiness?: Json;
          weak_links?: Json;
          comparison?: Json | null;
          untested?: Json;
        };
      };
      pilot_feedback: {
        Row: {
          id: string;
          run_id: string;
          usability: number | null;
          question_relevance: number | null;
          advice_usefulness: number | null;
          felt_repetitive: boolean | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          usability?: number | null;
          question_relevance?: number | null;
          advice_usefulness?: number | null;
          felt_repetitive?: boolean | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
