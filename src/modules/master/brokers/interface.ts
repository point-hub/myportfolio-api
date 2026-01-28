export interface IBroker {
  _id?: string
  code?: string
  name?: string
  branch?: string
  address?: string
  phone?: string
  account_number?: string
  account_name?: string
  notes?: string
  is_archived?: boolean | null | undefined
  created_at?: Date
  created_by_id?: string
}
