/**
 * Available rules
 * https://github.com/mikeerickson/validatorjs?tab=readme-ov-file#available-rules
 */

export const receiveCashbackRules = {
  received_date: ['required', 'string'],
  received_amount: ['required', 'numeric'],
  bank_id: ['required', 'string'],
  bank_account_uuid: ['required', 'string'],
};
