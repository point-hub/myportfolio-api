import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IAuthUser } from '@/modules/master/users/interface';
import type { IStock } from '@/modules/stocks/interface';

import type { IPaymentStock } from '../interface';
import type { IRetrieveManyRepository } from '../repositories/retrieve-many.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  retrieveManyRepository: IRetrieveManyRepository
  authorizationService: IAuthorizationService
}

export interface IData extends IPaymentStock {
  _id?: string
  form_number?: string
  broker_id?: string
  broker?: IBroker
  payment_date?: string
  transactions?: {
    uuid?: string
    stock_id?: string
    stock?: IStock
    transaction_number?: number
    date?: number
    amount?: number
  }[]
  created_by?: IAuthUser
  updated_by?: IAuthUser
  archived_by?: IAuthUser
}

export interface ISuccessData {
  data: IData[]
  pagination: {
    page: number
    page_count: number
    page_size: number
    total_document: number
  }
}

/**
 * Use case: Retrieve Payment Stocks.
 *
 * Responsibilities:
 * - Check whether the user is authorized to perform this action
 * - Retrieve all data from the database.
 * - Optionally filter response fields using `query.fields`.
 * - Return a success response.
 */
export class RetrieveManyUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Check whether the user is authorized to perform this action
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'payment-stocks:read');
    if (!isAuthorized) {
      return this.fail({ code: 403, message: 'You do not have permission to perform this action.' });
    }

    // Retrieve all data from the database.
    const response = await this.deps.retrieveManyRepository.handle(input.query);

    // Optionally filter response fields using `query.fields`.
    const fields = typeof input.query.fields === 'string'
      ? input.query.fields.split(',').map(f => f.trim())
      : null;

    // Return a success response.
    return this.success({
      data: response.data.map(item => {
        const mapped = {
          _id: item._id,
          form_number: item.form_number,
          payment_date: item.payment_date,
          broker_id: item.broker_id,
          broker: item.broker,
          transactions: item.transactions!,
          total: item.total,
          notes: item.notes,
          status: item.status,
          is_archived: item.is_archived,
        };

        // If no fields requested → return full object
        if (!fields) return mapped;

        // Otherwise → return only requested fields
        return Object.fromEntries(
          Object.entries(mapped).filter(([key]) => fields.includes(key)),
        );
      }),
      pagination: response.pagination,
    });
  }
}
