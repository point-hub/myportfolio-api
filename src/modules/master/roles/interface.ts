export interface IRole {
  _id?: string
  code?: string
  name?: string
  notes?: string | null
  permissions?: string[]
  is_archived?: boolean | null
  created_by_id?: string
  created_at?: Date
  updated_at?: Date | null
  updated_by_id?: string | null
  archived_at?: Date | null
  archived_by_id?: string | null
}
