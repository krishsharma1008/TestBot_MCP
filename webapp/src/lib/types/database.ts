export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  company: string | null
  plan: 'starter' | 'pro' | 'enterprise'
  credits_remaining: number
  credits_total: number
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface ApiKey {
  id: string
  user_id: string
  name: string
  key_prefix: string
  key_hash: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface TestRun {
  id: string
  user_id: string
  creation_name: string
  status: 'running' | 'passed' | 'failed' | 'error'
  total_tests: number
  passed_tests: number
  failed_tests: number
  skipped_tests: number
  backend_pass_rate: number | null
  frontend_pass_rate: number | null
  duration_ms: number | null
  report_json: any
  ai_analysis: any
  framework: string | null
  source: 'mcp' | 'api' | 'dashboard'
  created_at: string
  updated_at: string
}

export interface TestList {
  id: string
  user_id: string
  name: string
  description: string | null
  test_count: number
  last_run_at: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; email: string }
        Update: Partial<Profile>
      }
      api_keys: {
        Row: ApiKey
        Insert: Omit<ApiKey, 'id' | 'created_at'>
        Update: Partial<ApiKey>
      }
      test_runs: {
        Row: TestRun
        Insert: Omit<TestRun, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<TestRun>
      }
      test_lists: {
        Row: TestList
        Insert: Omit<TestList, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<TestList>
      }
    }
  }
}
