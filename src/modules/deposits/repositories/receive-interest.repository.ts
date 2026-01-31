import type { IDatabase, IDocument } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IReceiveInterestRepository {
  handle(_id: string, document: IDocument): Promise<IReceiveInterestOutput>
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

  async handle(_id: string, document: IDocument): Promise<IReceiveInterestOutput> {
    return await this.database.collection(collectionName).updateOne({ _id }, [
      {
        $set: {
          interest_schedule: {
            $map: {
              input: '$interest_schedule',
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
