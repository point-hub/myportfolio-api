/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const createRules = {
  form_number: ['required', 'string'],
  product: ['required', 'string'],
  year_issued: ['required', 'string'],
  transaction_date: ['required', 'string'],
  settlement_date: ['required', 'string'],
  maturity_date: ['required', 'string'],
  last_coupon_date: ['required', 'string'],
  bank_placement_id: ['required', 'string'],
  bank_placement_account_uuid: ['required', 'string'],
  bank_source_id: ['required', 'string'],
  bank_source_account_uuid: ['required', 'string'],
  transaction_number: ['required', 'string'],
  price: ['required', 'numeric'],
  principal_amount: ['required', 'numeric'],
  proceed_amount: ['required', 'numeric'],
  accrued_interest: ['required', 'numeric'],
  coupon_tenor: ['required', 'numeric'],
  coupon_gross_amount: ['required', 'numeric'],
  coupon_rate: ['required', 'numeric'],
  coupon_tax_rate: ['required', 'numeric'],
  coupon_tax_amount: ['required', 'numeric'],
  coupon_net_amount: ['required', 'numeric'],
  owner_id: ['required', 'string'],
  base_date: ['required', 'numeric'],
  notes: ['string'],
};
