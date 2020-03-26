
// ----------------------

import { WorkerImpl } from '../worker';

const ctx: Worker = self as any;
const worker = new WorkerImpl(ctx);

// initialize message handler
ctx.addEventListener('message', (event) => worker.OnMessage(event));
