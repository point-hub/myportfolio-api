export interface IBroker {
  _id?: string
  code?: string
  name?: string
  branch?: string
  address?: string
  phone?: string
  accounts?: {
    uuid?: string
    account_number?: string
    account_name?: string
  }[]
  notes?: string
  is_archived?: boolean | null | undefined
  created_at?: Date
  created_by_id?: string
  updated_at?: Date | null
  updated_by_id?: string | null
  archived_at?: Date | null
  archived_by_id?: string | null
}
