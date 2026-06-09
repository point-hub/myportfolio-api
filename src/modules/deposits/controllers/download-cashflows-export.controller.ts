import type { IController, IControllerInput, IQuery } from '@point-hub/papi';

import { RetrieveCashflowsRepository } from '../repositories/retrieve-cashflows.repository';

const excelHeaders = [
  'Date Form',
  'Form Number',
  'Jenis Investasi',
  'Rekening Bank',
  'Bank',
  'Keterangan',
  'Pendapatan',
  'Saldo Nominal Pokok',
  'Notes / Biaya',
  'Debit Pendapatan',
  'Kredit Pendapatan',
  'Rekening Pendapatan',
  'Saldo',
];

const escapeHtml = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const bankAccountLabel = (bank?: {
  name?: string
  account?: {
    account_number?: string
    account_name?: string
  }
}) => {
  return [
    bank?.name,
    bank?.account?.account_number,
    bank?.account?.account_name,
  ].filter(Boolean).join(' - ');
};

export const downloadCashflowsExportController: IController = async (controllerInput: IControllerInput) => {
  const token = controllerInput.req['query']['token'];
  if (typeof token !== 'string') {
    controllerInput.res.status(400);
    controllerInput.res.json({ message: 'Invalid export token' });
    return;
  }

  let payload: { exp?: number, query?: IQuery };
  try {
    payload = JSON.parse(Buffer.from(token, 'base64url').toString()) as { exp?: number, query?: IQuery };
  } catch {
    controllerInput.res.status(400);
    controllerInput.res.json({ message: 'Invalid export token' });
    return;
  }

  if (!payload.exp || payload.exp < Date.now()) {
    controllerInput.res.status(410);
    controllerInput.res.json({ message: 'Export link expired' });
    return;
  }

  const retrieveCashflowsRepository = new RetrieveCashflowsRepository(controllerInput.dbConnection);
  const response = await retrieveCashflowsRepository.handle({
    ...payload.query,
    page: 1,
    page_size: 10000,
  });

  const rows = response.data.map((item) => [
    item.transaction_date,
    item.form_number,
    item.investment_type,
    bankAccountLabel(item.bank_account),
    item.placement_bank?.name,
    item.description,
    item.income,
    item.principal_balance,
    item.notes,
    item.income_debit,
    item.income_credit,
    bankAccountLabel(item.income_account),
    item.balance,
  ]);

  const tableHead = excelHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const tableBody = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
    .join('');
  const excel = `
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>${tableHead}</tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
      </body>
    </html>
  `;

  controllerInput.res.setHeader('Content-Type', 'application/vnd.ms-excel');
  controllerInput.res.setHeader('Content-Disposition', 'attachment; filename="cashflow-report.xls"');
  controllerInput.res.status(200);
  controllerInput.res.send(excel);
};
