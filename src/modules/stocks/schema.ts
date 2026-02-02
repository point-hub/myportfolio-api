/**
 * MongoDB Schema
 *
 * https://www.mongodb.com/docs/current/core/schema-validation/update-schema-validation/
 * https://www.mongodb.com/docs/drivers/node/current/fundamentals/indexes/
 * https://www.mongodb.com/developer/products/mongodb/mongodb-schema-design-best-practices/
 */

import type { ISchema } from '@point-hub/papi';

import { collectionName } from './entity';

export const schema: ISchema[] = [
  {
    collection: collectionName,
    unique: [['form_number']],
    uniqueIfExists: [[]],
    indexes: [],
    schema: {
      bsonType: 'object',
      properties: {
        _id: {
          bsonType: 'objectId',
          description: 'Unique ID for the document.',
        },
        is_archived: {
          bsonType: 'bool',
          description: 'Indicates whether the record is archived.',
        },
        created_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when this record was created.',
        },
        created_by_id: {
          bsonType: 'objectId',
          description: 'The ID of the user who created this record.',
        },
      },
    },
  },
];
