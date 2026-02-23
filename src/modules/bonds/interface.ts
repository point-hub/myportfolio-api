export interface IReceivedCoupon {
  uuid: string
  date: string
  amount: number
  received_date?: string
  received_amount?: number
  remaining_amount?: number
  bank_id?: string
  bank_account_uuid?: string
}

export interface IBond {
  _id?: string
  form_number?: string;
  product?: string;
  publisher?: string;
  type?: string;
  series?: string;
  year_issued?: string;
  bank_source_id?: string;
  bank_source_account_uuid?: string;
  bank_placement_id?: string;
  bank_placement_account_uuid?: string;
  bank_disbursement_id?: string;
  bank_disbursement_account_uuid?: string;
  owner_id?: string;
  base_date?: number;
  transaction_date?: string;
  settlement_date?: string;
  maturity_date?: string;
  transaction_number?: number;
  price?: number;
  principal_amount?: number;
  remaining_amount?: number;
  proceed_amount?: number;
  accrued_interest?: number;
  total_proceed?: number;
  coupon_tenor?: number;
  coupon_rate?: number;
  coupon_gross_amount?: number;
  coupon_tax_rate?: number;
  coupon_tax_amount?: number;
  coupon_net_amount?: number;
  coupon_date?: string;
  received_coupons?: IReceivedCoupon[];
  disbursement_date?: string;
  disbursement_bank?: string;
  disbursement_bank_id?: string;
  disbursement_bank_account_uuid?: string;
  disbursement_amount?: number;
  disbursement_amount_received?: number;
  disbursement_amount_difference?: number;
  disbursement_remaining?: number;
  selling_price?: number;
  notes?: string | null;
  is_archived?: boolean | null;
  created_at?: Date;
  created_by_id?: string;
  updated_at?: Date | null;
  updated_by_id?: string | null;
  archived_at?: Date | null;
  archived_by_id?: string | null;
  status?: 'active' | 'draft' | 'completed';
  coupon_status?: 'pending' | 'completed';
}
