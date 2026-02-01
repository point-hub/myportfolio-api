import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IReceiveCashbackRepository {
  handle(_id: string, document: IDocument): Promise<IReceiveCashbackOutput>
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

  async handle(_id: string, document: IDocument): Promise<IReceiveCashbackOutput> {
    return await this.database.collection(collectionName).updateOne({ _id }, [
      {
        $set: {
          cashback_schedule: {
            $map: {
              input: '$cashback_schedule',
              as: 'item',
              in: {
                $cond: [
                  { $eq: ['$$item.payment_date', document['payment_date']] },
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
