
import { RunAllTests } from '@util';
import fs from 'node:fs/promises';

import './tests/math-basic';
import './tests/math-rounding';
import './tests/math-trig';
import './tests/text-basic';
import './tests/logical-basic';
import './tests/lookup-basic';
import './tests/lookup-vlookup';

const results = await RunAllTests();
await fs.writeFile('test-results.json', JSON.stringify(results, undefined, 2), { encoding: 'utf-8' });

