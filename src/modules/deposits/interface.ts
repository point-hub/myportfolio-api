import type { IBank } from '../master/banks/interface';

export interface IDeposit {
  _id?: string
  form_number?: string
  owner_id?: string
  group_id?: string
  placement?: {
    bank_id?: string
    bilyet_number?: string
    base_date?: number
    date?: string
    term?: number
    maturity_date?: string
    amount?: number
  }
  source?: {
    bank_id?: string
    bank_account_uuid?: string
  }
  interest?: {
    payment_method?: string
    rate?: number
    gross_amount?: number
    tax_rate?: number
    tax_amount?: number
    net_amount?: number
    bank_id?: string
    bank_account_uuid?: string
    is_rollover?: boolean
  }
  interest_schedule?: {
    term?: number
    payment_date?: string
    amount?: number
    received_date?: string
    received_amount?: number
  }[]
  cashback?: {
    bank_id?: string
    bank_account_uuid?: string
  }
  cashback_schedule?: {
    payment_date?: string
    rate?: number
    amount?: number
    received_date?: string
    received_amount?: number
  }[]
  withdrawal?: {
    received_date?: string
    received_amount?: number
    remaining_amount?: number
    bank?: IBank
  }
  notes?: string | null | undefined
  is_archived?: boolean | null
  status?: 'draft' | 'active' | 'completed'
  created_at?: Date
  created_by_id?: string
}
