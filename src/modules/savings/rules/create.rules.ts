/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const createRules = {
  form_number: ['required', 'string'],
  owner_id: ['required', 'string'],
  group_id: ['required', 'string'],
  'placement.type': ['required', 'string'],
  'placement.bank_id': ['required', 'string'],
  'placement.account_number': ['required', 'string'],
  'placement.base_date': ['required', 'numeric'],
  'placement.date': ['required', 'string'],
  'placement.term': ['required', 'numeric'],
  'placement.maturity_date': ['required', 'string'],
  'placement.amount': ['required', 'numeric', 'min:1'],
  'source.bank_id': ['required', 'string'],
  'source.bank_account_uuid': ['required', 'string'],
  'interest.bank_id': ['required', 'string'],
  'interest.bank_account_uuid': ['required', 'string'],
  'interest.payment_method': ['required', 'string'],
  'interest.rate': ['required', 'numeric', 'min:1'],
  'interest.gross_amount': ['required', 'numeric', 'min:1'],
  'interest.tax_rate': ['required', 'numeric', 'min:1'],
  'interest.tax_amount': ['required', 'numeric', 'min:1'],
  'interest.net_amount': ['required', 'numeric', 'min:1'],
  'interest.is_rollover': ['required', 'boolean'],
  'interest_schedule.*.payment_date': ['required', 'string'],
  'interest_schedule.*.term': ['required', 'numeric'],
  'interest_schedule.*.amount': ['required', 'numeric'],
  'cashback_schedule.*.payment_date': ['required', 'string'],
  'cashback_schedule.*.rate': ['required', 'numeric'],
  'cashback_schedule.*.amount': ['required', 'numeric'],
  notes: ['string'],
};
