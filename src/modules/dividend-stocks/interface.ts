export interface IDividendStock {
  _id?: string
  form_number?: string
  broker_id?: string
  bank_id?: string
  bank_account_uuid?: string
  dividend_date?: string
  transactions?: {
    uuid?: string
    issuer_id?: string
    owner_id?: string
    dividend_date?: string
    shares?: number
    dividend_amount?: number
    total_dividend?: number
    received_amount?: number
  }[]
  total_received?: number
  notes?: string | null | undefined
  is_archived?: boolean | null
  status?: 'draft' | 'active'
  created_at?: Date
  created_by_id?: string
  updated_at?: Date | null
  updated_by_id?: string | null
  archived_at?: Date | null
  archived_by_id?: string | null
}
