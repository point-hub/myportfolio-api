import { BaseUseCase, type IQuery, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IAuthorizationService } from '@/modules/_shared/services/authorization.service';
import type { IBroker } from '@/modules/master/brokers/interface';
import type { IIssuer } from '@/modules/master/issuers/interface';
import type { IOwner } from '@/modules/master/owners/interface';
import type { IAuthUser } from '@/modules/master/users/interface';

import type { IStock } from '../interface';
import type { IRetrieveManyRepository } from '../repositories/retrieve-many.repository';

export interface IInput {
  authUser: IAuthUser
  query: IQuery
}

export interface IDeps {
  retrieveManyRepository: IRetrieveManyRepository
  authorizationService: IAuthorizationService
}

export interface IData extends IStock {
  broker?: IBroker
  owner?: IOwner
  buying_list?: {
    uuid?: string
    issuer_id?: string
    issuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
  }[]
  selling_list?: {
    uuid?: string
    issuer_id?: string
    issuer?: IIssuer
    lots?: number
    shares?: number
    price?: number
    total?: number
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
 * Use case: Retrieve Stocks.
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
    const isAuthorized = this.deps.authorizationService.hasAccess(input.authUser.role?.permissions, 'stocks:read');
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
          transaction_date: item.transaction_date,
          settlement_date: item.settlement_date,
          broker_id: item.broker_id,
          broker: item.broker,
          transaction_number: item.transaction_number!,
          owner_id: item.owner_id,
          owner: item.owner,
          buying_list: item.buying_list,
          selling_list: item.selling_list,
          buying_total: item.buying_total,
          buying_brokerage_fee: item.buying_brokerage_fee,
          buying_vat: item.buying_vat,
          buying_levy: item.buying_levy,
          buying_kpei: item.buying_kpei,
          buying_stamp: item.buying_stamp,
          buying_proceed: item.buying_proceed,
          selling_total: item.selling_total,
          selling_brokerage_fee: item.selling_brokerage_fee,
          selling_vat: item.selling_vat,
          selling_levy: item.selling_levy,
          selling_kpei: item.selling_kpei,
          selling_stamp: item.selling_stamp,
          selling_proceed: item.selling_proceed,
          proceed_amount: item.proceed_amount,
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
