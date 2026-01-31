import type { ICounter } from '@/modules/counters/interface';

export const getCounters = (): ICounter[] => {
  return [
    { name: 'roles', template: 'ROLE/<seq>', seq: 1 },
    { name: 'owners', template: 'OWNER/<seq>', seq: 0 },
    { name: 'banks', template: 'BANK/<seq>', seq: 0 },
    { name: 'brokers', template: 'BROKER/<seq>', seq: 0 },
    { name: 'stocks', template: 'STOCK/<seq>/<yyyy><mm>', seq: 0 },
    { name: 'savings', template: 'SAV/<seq>/<yyyy><mm>', seq: 0 },
    { name: 'deposits', template: 'DEPO/<seq>/<yyyy><mm>', seq: 0 },
    { name: 'bonds', template: 'BOND/<seq>/<yyyy><mm>', seq: 0 },
    { name: 'insurances', template: 'INS/<seq>/<yyyy><mm>', seq: 0 },
  ];
};
