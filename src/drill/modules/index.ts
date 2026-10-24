import type { DrillModule } from '../types';
import { oddsDrill } from './oddsDrill';
import { preflopDrill } from './preflopDrill';
import { pushFoldDrill } from './pushFoldDrill';

export const ALL_MODULES: DrillModule[] = [oddsDrill, preflopDrill, pushFoldDrill];
