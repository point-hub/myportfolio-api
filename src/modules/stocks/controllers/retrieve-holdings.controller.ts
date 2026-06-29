import type { IController, IControllerInput } from '@point-hub/papi';

import { AuthorizationService } from '@/modules/_shared/services/authorization.service';

import { RetrieveHoldingsRepository } from '../repositories/retrieve-holdings.repository';
import type { ISuccessData } from '../use-cases/retrieve-holdings.use-case';
import { RetrieveHoldingsUseCase } from '../use-cases/retrieve-holdings.use-case';

const escapeHtml = (value: unknown): string => {
  const text = value === undefined || value === null ? '' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatNumber = (value: unknown): string => {
  const number = Number(value || 0);

  return Number.isInteger(number) ? String(number) : number.toFixed(2);
};

const formatDateFilter = (value: unknown): string => {
  if (!value) return '-';

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const createHoldingsSpreadsheet = (
  data: ISuccessData,
  query: IControllerInput['req']['query'],
): string => {
  const brokerLabel = query?.['search.broker_id'] ? data.data[0]?.broker?.name || 'Selected Broker' : 'ALL BROKER';
  const instrumentLabel = query?.['search.issuer_id'] ? data.data[0]?.issuer?.code || 'SELECTED INSTRUMENT' : 'ALL INSTRUMENT';
  const dateFrom = formatDateFilter(query?.['search.transaction_date_from']);
  const dateTo = formatDateFilter(query?.['search.transaction_date_to']);

  const rows = data.data.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(item.issuer?.code)}</td>
      <td>${escapeHtml(item.issuer?.name)}</td>
      <td>${escapeHtml(item.broker?.name || 'All Broker')}</td>
      <td class="number">${formatNumber(item.number_of_shares)}</td>
      <td class="number">${formatNumber(item.total_buying_price)}</td>
      <td class="number">${formatNumber(item.average_buying_price)}</td>
    </tr>`).join('');

  const totalShares = data.data.reduce((total, item) => total + Number(item.number_of_shares || 0), 0);
  const totalBuyingPrice = data.data.reduce((total, item) => total + Number(item.total_buying_price || 0), 0);
  const averageBuyingPrice = totalShares ? totalBuyingPrice / totalShares : 0;

  return `
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
          td, th { border: 1px solid #000000; padding: 6px 8px; vertical-align: middle; }
          .title { background: #d9ead3; font-size: 14pt; font-weight: 700; text-align: center; }
          .filter-label { background: #fce5cd; font-weight: 700; }
          .filter-value { background: #fff2cc; font-weight: 700; text-align: center; }
          .header { background: #d9ead3; font-weight: 700; text-align: center; }
          .total-label { background: #fce5cd; font-weight: 700; text-align: right; }
          .number { mso-number-format:"\\#\\,\\#\\#0\\.00"; text-align: right; }
          .center { text-align: center; }
          .spacer td { border: 0; height: 12px; }
        </style>
      </head>
      <body>
        <table>
          <colgroup>
            <col style="width: 48px" />
            <col style="width: 110px" />
            <col style="width: 220px" />
            <col style="width: 140px" />
            <col style="width: 150px" />
            <col style="width: 180px" />
            <col style="width: 180px" />
          </colgroup>
          <tr>
            <td class="title" colspan="7">NEW REPORT STOCK AVAILABLE</td>
          </tr>
          <tr class="spacer"><td colspan="7"></td></tr>
          <tr>
            <td class="filter-label" colspan="2">BROKER</td>
            <td class="filter-value" colspan="2">${escapeHtml(brokerLabel)}</td>
            <td class="filter-label">DATE</td>
            <td class="filter-value">${escapeHtml(dateFrom)}</td>
            <td class="filter-value">${escapeHtml(dateTo)}</td>
          </tr>
          <tr>
            <td class="filter-label" colspan="2">INSTRUMENT</td>
            <td class="filter-value" colspan="5">${escapeHtml(instrumentLabel)}</td>
          </tr>
          <tr class="spacer"><td colspan="7"></td></tr>
          <tr>
            <th class="header">ID</th>
            <th class="header">CODE</th>
            <th class="header">INSTRUMENT</th>
            <th class="header">BROKER</th>
            <th class="header">NUMBER OF SHARE</th>
            <th class="header">TOTAL BUYING PRICE</th>
            <th class="header">AVERAGE BUYING PRICE</th>
          </tr>
          ${rows || '<tr><td class="center" colspan="7">No data</td></tr>'}
          <tr>
            <td class="total-label" colspan="4">TOTAL HOLDINGS</td>
            <td class="number">${formatNumber(totalShares)}</td>
            <td class="number">${formatNumber(totalBuyingPrice)}</td>
            <td class="number">${formatNumber(averageBuyingPrice)}</td>
          </tr>
        </table>
      </body>
    </html>`;
};

export const retrieveHoldingsController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    const retrieveHoldingsRepository = new RetrieveHoldingsRepository(controllerInput.dbConnection);
    const retrieveHoldingsUseCase = new RetrieveHoldingsUseCase({
      retrieveHoldingsRepository,
      authorizationService: AuthorizationService,
    });

    const response = await retrieveHoldingsUseCase.handle({
      authUser: controllerInput.req['authUser'],
      query: controllerInput.req['query'],
    });

    if (response.status === 'failed') {
      controllerInput.res.status(response.error.code);
      controllerInput.res.statusMessage = response.error.message;
      controllerInput.res.json(response.error);
      return;
    }

    await session.commitTransaction();

    if (controllerInput.req['query']?.['export'] === 'csv') {
      controllerInput.res.status(200);
      controllerInput.res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      controllerInput.res.setHeader('Content-Disposition', 'attachment; filename="stock-holdings.xls"');
      controllerInput.res.send(createHoldingsSpreadsheet(response.data, controllerInput.req['query']));
      return;
    }

    controllerInput.res.status(200);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
