import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

interface IFilter {
  _id: string
  uuid: string
}

export interface IReceiveCashbackRepository {
  handle(filter: IFilter, document: IDocument): Promise<IReceiveCashbackOutput>
}

export interface IReceiveCashbackOutput {
  matched_count: number
  modified_count: number
}

export class ReceiveCashbackRepository implements IReceiveCashbackRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(filter: IFilter, document: IDocument): Promise<IReceiveCashbackOutput> {
    return await this.database.collection(collectionName).updateOne({ _id: filter._id }, [
      {
        $set: {
          cashback_schedule: {
            $map: {
              input: '$cashback_schedule',
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
