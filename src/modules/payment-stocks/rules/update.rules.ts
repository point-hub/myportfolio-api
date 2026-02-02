/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const updateRules = {
  form_number: ['required', 'string'],
  broker_id: ['required', 'string'],
  payment_date: ['required', 'string'],
  'transactions.*.stock_id': ['required', 'string'],
  'transactions.*.transaction_number': ['required', 'string'],
  'transactions.*.date': ['required', 'string'],
  'transactions.*.amount': ['required', 'numeric'],
  total: ['required', 'numeric'],
  notes: ['string'],
};
