import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

interface IFilter {
  _id: string
  uuid: string
}

export interface IReceiveInterestRepository {
  handle(filter: IFilter, document: IDocument): Promise<IReceiveInterestOutput>
}

export interface IReceiveInterestOutput {
  matched_count: number
  modified_count: number
}

export class ReceiveInterestRepository implements IReceiveInterestRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(filter: IFilter, document: IDocument): Promise<IReceiveInterestOutput> {
    return await this.database.collection(collectionName).updateOne({ _id: filter._id }, [
      {
        $set: {
          interest_schedule: {
            $map: {
              input: '$interest_schedule',
              as: 'item',
              in: {
                $cond: [
                  { $eq: ['$$item.uuid', filter['uuid']] },
                  {
                    $mergeObjects: [
                      '$$item',
                      document,
                    ],
                  },
                  '$$item',
                ],
              },
            },
          },
        },
      },
    ], { ...this.options });
  }
}
