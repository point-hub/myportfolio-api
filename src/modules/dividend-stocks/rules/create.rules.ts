/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const createRules = {
  form_number: ['required', 'string'],
  broker_id: ['required', 'string'],
  bank_id: ['required', 'string'],
  bank_account_uuid: ['required', 'string'],
  dividend_date: ['required', 'string'],
  'transactions.*.issuer_id': ['required', 'string'],
  'transactions.*.owner_id': ['required', 'string'],
  'transactions.*.shares': ['required', 'numeric'],
  'transactions.*.dividend_amount': ['required', 'numeric'],
  'transactions.*.total_dividend': ['required', 'numeric'],
  'transactions.*.received_amount': ['required', 'numeric'],
  total_received: ['required', 'numeric'],
  notes: ['string'],
};
