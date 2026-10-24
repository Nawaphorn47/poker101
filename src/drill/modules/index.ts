import type { DrillModule } from '../types';
import { oddsDrill } from './oddsDrill';
import { preflopDrill } from './preflopDrill';
import { pushFoldDrill } from './pushFoldDrill';
import { madeHandDrill } from './madeHandDrill';
import { outsDrill } from './outsDrill';

export const ALL_MODULES: DrillModule[] = [oddsDrill, preflopDrill, pushFoldDrill, madeHandDrill, outsDrill];
