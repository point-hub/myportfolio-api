/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const createRules = {
  form_number: ['required', 'string'],
  transaction_date: ['required', 'string'],
  settlement_date: ['required', 'string'],
  broker_id: ['required', 'string'],
  transaction_number: ['required', 'string'],
  owner_id: ['required', 'string'],
  'buying_list.*.issuer_id': ['required', 'string'],
  'buying_list.*.lots': ['required', 'numeric', 'min:1'],
  'buying_list.*.shares': ['required', 'numeric', 'min:1'],
  'buying_list.*.price': ['required', 'numeric', 'min:1'],

  'selling_list.*.issuer_id': ['required', 'string'],
  'selling_list.*.lots': ['required', 'numeric', 'min:1'],
  'selling_list.*.shares': ['required', 'numeric', 'min:1'],
  'selling_list.*.price': ['required', 'numeric', 'min:1'],

  'buying_brokerage_fee': ['required', 'numeric', 'min:1'],
  'buying_vat': ['required', 'numeric', 'min:1'],
  'buying_levy': ['required', 'numeric', 'min:1'],
  'buying_kpei': ['required', 'numeric', 'min:1'],
  'buying_stamp': ['required', 'numeric', 'min:1'],
  'selling_brokerage_fee': ['required', 'numeric', 'min:1'],
  'selling_vat': ['required', 'numeric', 'min:1'],
  'selling_levy': ['required', 'numeric', 'min:1'],
  'selling_kpei': ['required', 'numeric', 'min:1'],
  'selling_stamp': ['required', 'numeric', 'min:1'],
  notes: ['string'],
};
