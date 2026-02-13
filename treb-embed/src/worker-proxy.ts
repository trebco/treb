/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * this is a wrapper for workers. we want to support node in addition to the 
 * browser. bun seems to support web APIs with no modification, but node needs 
 * special attention. not sure about deno.
 */
export class WorkerProxy<TX, RX=TX> {

  public node_semantics = false;
  public worker?: Worker;

  public Terminate() {
    this.worker?.terminate();
  }

  public async Init(url: string) {

    let _worker;

    if (typeof Worker === 'undefined') {
      const { Worker: NodeWorker } = await import('node:worker_threads');
      _worker = NodeWorker;
      this.node_semantics = true;
    } 
    else {
      _worker = Worker;
    }

    this.worker = new _worker(new URL(url, import.meta.url), { 
      type: 'module' 
    }) as Worker;

  }

  public PostMessage(message: TX) {
    // apparently postMessage works on node workers as well?
    this.worker?.postMessage(message);
  }

  public OnMessage(fn: (message: MessageEvent<RX>) => (void|Promise<void>)) {
    if (this.worker) {
      if (this.node_semantics) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.worker as any).on('message', (data: any) => fn({data} as MessageEvent<RX>));
      }
      else {
        this.worker.onmessage = fn;
      }
    }
  }

  public OnError(fn: (message: ErrorEvent) => (void|Promise<void>)) {
    if (this.worker) {
      if (this.node_semantics) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.worker as any).on('error', (err: any) => fn({error: err} as ErrorEvent));
      }
      else {
        this.worker.onerror = fn;
      }
    }
  }

}

/**
 * this is for the worker side, to normalize postMessage/onmessage
 */
export const GetWorkerContext =  async (): Promise<Worker> => {

  let ctx: Worker;
  if (typeof self === 'undefined') {
    const { parentPort } = await import('node:worker_threads');
    ctx = {
      postMessage: (data: unknown) => {
        parentPort?.postMessage(data);
      },
      addEventListener: (type: 'message', handler: (event: MessageEvent) => void) => {
        parentPort?.on('message', (data) => {
          handler({ data } as MessageEvent);
        });
      },
    } as unknown as Worker;
  }
  else {
    ctx = self as unknown as Worker;
  }

  return ctx;

};