import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import type { IAuthUser } from '../../users/interface';
import { collectionName } from '../entity';

export interface IRetrieveAccountsRepository {
  handle(query: IQuery): Promise<IRetrieveAccountsOutput>
  raw(query: IQuery): Promise<IRetrieveAccountsRawOutput>
}

export interface IData {
  _id: string
  code: string
  name: string
  branch: string
  address: string
  phone: string
  account_uuid: string
  account_number: string
  account_name: string
  notes: string
  is_archived: boolean
  created_at: Date
  created_by: IAuthUser
}

export interface IRetrieveAccountsOutput {
  data: IData[]
  pagination: IPagination
}

export interface IRetrieveAccountsRawOutput {
  data: IData[]
  pagination: IPagination
}

export class RetrieveAccountsRepository implements IRetrieveAccountsRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveAccountsOutput> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeFlattenAccounts());
    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeJoinCreatedById());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IData>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          code: item.code,
          name: item.name,
          branch: item.branch,
          address: item.address,
          phone: item.phone,
          account_uuid: item.account_uuid,
          account_name: item.account_name,
          account_number: item.account_number,
          notes: item.notes,
          is_archived: item.is_archived,
          created_at: item.created_at,
          created_by: item.created_by,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveAccountsRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IData>(query, this.options);
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    // General search across multiple fields
    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = ['code', 'name', 'branch', 'address', 'phone', 'account_number', 'account_name'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'code', query?.['search.code']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'name', query?.['search.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'branch', query?.['search.branch']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'address', query?.['search.address']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'phone', query?.['search.phone']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'account_number', query?.['search.account_number']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'account_name', query?.['search.account_name']);

    // Filter boolean
    BaseMongoDBQueryFilters.addBooleanFilter(filters, 'is_archived', query?.['search.is_archived']);

    return filters.length > 0 ? [{ $match: { $and: filters } }] : [];
  }

  private pipeFlattenAccounts(): IPipeline[] {
    return [
      {
        $unwind: {
          path: '$accounts',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          account_uuid: '$accounts.uuid',
          account_name: '$accounts.account_name',
          account_number: '$accounts.account_number',
        },
      },
    ];
  }

  private pipeJoinCreatedById(): IPipeline[] {
    return [
      {
        $lookup: {
          from: 'users',
          let: { userId: '$created_by_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                username: 1,
                email: 1,
              },
            },
          ],
          as: 'created_by',
        },
      },
      {
        $unwind: {
          path: '$created_by',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  private pipeProject(): IPipeline[] {
    return [
      {
        $project: {
          _id: 1,
          code: 1,
          name: 1,
          branch: 1,
          address: 1,
          phone: 1,
          account_uuid: 1,
          account_name: 1,
          account_number: 1,
          notes: 1,
          is_archived: 1,
          created_at: 1,
          created_by: 1,
        },
      },
    ];
  }
}
