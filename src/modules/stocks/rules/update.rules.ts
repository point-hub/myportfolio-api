/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const updateRules = {
  form_number: ['required', 'string'],
  transaction_date: ['required', 'string'],
  settlement_date: ['required', 'string'],
  broker_id: ['required', 'string'],
  transaction_number: ['required', 'string'],
  owner_id: ['required', 'string'],
  'buying_list.*.issuer_id': ['required', 'string'],
  'buying_list.*.lots': ['required', 'numeric'],
  'buying_list.*.shares': ['required', 'numeric'],
  'buying_list.*.price': ['required', 'numeric'],
  'buying_list.*.total': ['required', 'numeric'],
  'selling_list.*.issuer_id': ['required', 'string'],
  'selling_list.*.lots': ['required', 'numeric'],
  'selling_list.*.shares': ['required', 'numeric'],
  'selling_list.*.price': ['required', 'numeric'],
  'selling_list.*.total': ['required', 'numeric'],
  notes: ['string'],
};
