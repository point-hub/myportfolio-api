import type { IDatabase, IPagination, IPipeline, IQuery } from '@point-hub/papi';
import { BaseMongoDBQueryFilters } from '@point-hub/papi';

import { collectionName } from '../entity';
import type { IOwner } from '../interface';
import type { IRetrieveOutput } from './retrieve.repository';

export interface IRetrieveManyRepository {
  handle(query: IQuery): Promise<IRetrieveManyOutput>
  raw(query: IQuery): Promise<IRetrieveManyRawOutput>
}

export interface IRetrieveManyOutput {
  data: IRetrieveOutput[]
  pagination: IPagination
}

export interface IRetrieveManyRawOutput {
  data: IOwner[]
  pagination: IPagination
}

export class RetrieveManyRepository implements IRetrieveManyRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(query: IQuery): Promise<IRetrieveManyOutput> {
    const pipeline: IPipeline[] = [];

    pipeline.push(...this.pipeQueryFilter(query));
    pipeline.push(...this.pipeJoinCreatedById());
    pipeline.push(...this.pipeProject());

    const response = await this.database.collection(collectionName).aggregate<IRetrieveOutput>(pipeline, query, this.options);

    return {
      data: response.data.map(item => {
        return {
          _id: item._id,
          code: item.code,
          name: item.name,
          notes: item.notes,
          is_archived: item.is_archived,
          created_at: item.created_at,
          created_by: item.created_by,
        };
      }),
      pagination: response.pagination,
    };
  }

  async raw(query: IQuery): Promise<IRetrieveManyRawOutput> {
    return await this.database.collection(collectionName).retrieveMany<IOwner>(query, this.options);
  }

  private pipeQueryFilter(query: IQuery): IPipeline[] {
    const filters: Record<string, unknown>[] = [];

    // General search across multiple fields
    if (query?.['search.all']) {
      const searchRegex = { $regex: query?.['search.all'], $options: 'i' };
      const fields = ['code', 'name'];
      filters.push({
        $or: fields.map((field) => ({ [field]: searchRegex })),
      });
    }

    // Filter specific field
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'code', query?.['search.code']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'name', query?.['search.name']);
    BaseMongoDBQueryFilters.addRegexFilter(filters, 'notes', query?.['search.notes']);

    // Filter boolean
    BaseMongoDBQueryFilters.addBooleanFilter(filters, 'is_archived', query?.['search.is_archived']);

    return filters.length > 0 ? [{ $match: { $and: filters } }] : [];
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
          notes: 1,
          is_archived: 1,
          created_at: 1,
          created_by: 1,
        },
      },
    ];
  }
}
