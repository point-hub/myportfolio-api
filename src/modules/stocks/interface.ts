export interface IStock {
  _id?: string
  form_number?: string
  transaction_date?: string
  settlement_date?: Date
  broker_id?: string
  owner_id?: string
  transaction_number?: string
  buying_list?: {
    uuid?: string
    issuer_id?: string
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  selling_list?: {
    uuid?: string
    issuer_id?: string
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  buying_total?: number
  buying_brokerage_fee?: number
  buying_vat?: number
  buying_levy?: number
  buying_kpei?: number
  buying_stamp?: number
  buying_proceed?: number
  selling_total?: number
  selling_brokerage_fee?: number
  selling_vat?: number
  selling_levy?: number
  selling_kpei?: number
  selling_stamp?: number
  selling_proceed?: number
  proceed_amount?: number
  notes?: string | null | undefined
  is_archived?: boolean | null
  status?: 'draft' | 'active' | 'paid'
  created_at?: Date
  created_by_id?: string
  updated_at?: Date | null
  updated_by_id?: string | null
  archived_at?: Date | null
  archived_by_id?: string | null
}
