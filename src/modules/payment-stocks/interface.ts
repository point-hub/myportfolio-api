export interface IPaymentStock {
  _id?: string
  form_number?: string
  broker_id?: string
  payment_date?: string
  transactions?: {
    uuid?: string
    stock_id?: string
    date?: number
    transaction_number?: number
    amount?: number
  }[]
  total?: number
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
