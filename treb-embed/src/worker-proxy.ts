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
 * 
 * switching to specific classes for different environments. also the plan is
 * to add a main-thread (i.e. no-worker, inline calc) version.
 * 
 */
export interface WorkerProxy<TX, RX = TX> {

  /** terminate worker */
  Terminate: () => void;

  /** initialize, possibly loading code */
  Init: (url: string) => Promise<void>;

  /** wrapper for postMessage */
  PostMessage: (message: TX) => void;

  /** wrapper for addEventListener */
  OnMessage: (fn: (message: MessageEvent<RX>) => void | Promise<void>) => void;

  /** wrapper for addEventListener */
  OnError: (fn: (message: ErrorEvent) => void | Promise<void>) => void;

}

function CheckNodeSemantics() {
  return typeof Worker === 'undefined';
}

export class WorkerProxyBrowser<TX, RX=TX> implements WorkerProxy<TX, RX> {

  public worker?: Worker;

  public Terminate() {
    this.worker?.terminate();
  }

  public async Init(url: string) {
    this.worker = new Worker(new URL(url, import.meta.url), { 
      type: 'module' 
    }) as Worker;
  }

  public PostMessage(message: TX) {
    this.worker?.postMessage(message);
  }

  public OnMessage(fn: (message: MessageEvent<RX>) => (void|Promise<void>)) {
    if (this.worker) {
      this.worker.onmessage = fn;
    }
  }

  public OnError(fn: (message: ErrorEvent) => (void|Promise<void>)) {
    if (this.worker) {
      this.worker.onerror = fn;
    }
  }

}

export class WorkerProxyNode<TX, RX=TX> implements WorkerProxy<TX, RX> {

  public worker?: {
    postMessage: (message: TX) => void|Promise<void>;
    terminate: () => void;
    on: (type: 'message'|'error', handler: (data: RX) => void|Promise<void>) => void;
  };

  public Terminate() {
    this.worker?.terminate();
  }

  public async Init(url: string) {
    const { Worker: NodeWorker } = await import('node:worker_threads');
    this.worker = new NodeWorker(new URL(url, import.meta.url));
  }

  public PostMessage(message: TX) {
    // apparently postMessage works on node workers as well?
    this.worker?.postMessage(message);
  }

  public OnMessage(fn: (message: MessageEvent<RX>) => (void|Promise<void>)) {
    if (this.worker) {
      this.worker.on('message', (data: RX) => fn({data} as MessageEvent<RX>));
    }
  }

  public OnError(fn: (message: ErrorEvent) => (void|Promise<void>)) {
    if (this.worker) {
      this.worker.on('error', (err) => fn({error: err} as ErrorEvent));
    }
  }

}

interface InProcessContext<TX, RX> {
  addEventListener: (type: 'message', handler: (event: MessageEvent<TX>) => void|Promise<void>) => void;
  postMessage: (data: RX) => void;
}

let in_process_worker_context: InProcessContext<unknown, unknown>|undefined = undefined;

type composite<TX, RX> = WorkerProxy<TX, RX> & InProcessContext<TX, RX>;

export class WorkerProxyInProcess<TX, RX = TX> implements composite<TX, RX> {

  protected tx_cache: TX[] = [];
  protected main_thread_to_worker_message_handler?: (event: MessageEvent<TX>) => void|Promise<void>;

  protected rx_cache: RX[] = [];
  protected worker_to_main_thread_message_handler?: (message: MessageEvent<RX>) => void|Promise<void>;

  public Terminate() {
    this.tx_cache = [];
    this.rx_cache = [];
    this.main_thread_to_worker_message_handler = undefined;
    this.worker_to_main_thread_message_handler = undefined;
  }

  public async Init(url: string) {
    in_process_worker_context = this as InProcessContext<unknown, unknown>;
    /* @vite-ignore */
    await import(new URL(url, import.meta.url).toString());
  }

  /** post message from "worker" to "main thread" */
  public PostMessage(message: TX) {
    if (this.main_thread_to_worker_message_handler) {
      // console.info('calling handler', message);
      const handler = this.main_thread_to_worker_message_handler;
      Promise.resolve().then(() => handler({data: message} as MessageEvent<TX>));
    } 
    else {
      // console.info("no handler, caching message");
      this.tx_cache.push(message);
    }   
  }

  /** callback when "main thread" sends message to "worker" */
  public OnMessage(fn: (message: MessageEvent<RX>) => (void|Promise<void>)) {
    this.worker_to_main_thread_message_handler = fn;
    if (this.rx_cache.length) {
      const copy = [...this.rx_cache];
      this.rx_cache = [];
      this.FlushCache(copy, fn);      
    }
  } 

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public OnError(fn: (message: ErrorEvent) => (void|Promise<void>)) {
    // ??
  }

  public FlushCache<T>(cache: T[], fn: (message: MessageEvent<T>) => void|Promise<void>) {
    // console.info(`flush cache ${cache.length}`);
    Promise.resolve().then(async () => {
      for (const message of cache) {
        const result = fn({data: message} as MessageEvent);
        if (result instanceof Promise) {
          await result; // serial?
        }
      }
    });
  }

  public addEventListener(type: 'message', handler: (event: MessageEvent<TX>) => void|Promise<void>): void {
    this.main_thread_to_worker_message_handler = handler;
    if (this.tx_cache.length) {
      const copy = [...this.tx_cache];
      this.tx_cache = [];
      this.FlushCache(copy, handler);
    }
  }

  public postMessage(data: RX): void {
    if (this.worker_to_main_thread_message_handler) {
      this.worker_to_main_thread_message_handler({data} as MessageEvent);
    }
    else {
      this.rx_cache.push(data);
    }
  }

}

/**
 * factory method for workers. supports web workers (also bun), node workers
 * and (via parameter) in-process workers. we're still figuring out how to 
 * signal that we're in process, currently somewhat clumsy
 * 
 * @param in_process 
 * @returns 
 */
export function CreateWorker<TX, RX = TX>(in_process = false): WorkerProxy<TX, RX> {
  if (in_process) {
    if (process.env.NODE_ENV !== 'production') {
      if (!(globalThis as {worker_console_message?: boolean}).worker_console_message) {
        console.info('using in-process worker');
        (globalThis as {worker_console_message?: boolean}).worker_console_message = true;
      }
    }
    return new WorkerProxyInProcess<TX, RX>();
  }
  if (CheckNodeSemantics()) {
    if (process.env.NODE_ENV !== 'production') {
      if (!(globalThis as {worker_console_message?: boolean}).worker_console_message) {
        console.info('using node worker');
        (globalThis as {worker_console_message?: boolean}).worker_console_message = true;
      }
    }
    return new WorkerProxyNode<TX, RX>();
  }
  if (process.env.NODE_ENV !== 'production') {
    if (!(globalThis as {worker_console_message?: boolean}).worker_console_message) {
      console.info('using standard web worker');
      (globalThis as {worker_console_message?: boolean}).worker_console_message = true;
    }
  }
  return new WorkerProxyBrowser<TX, RX>();
};

/**
 * this is for the worker side, to normalize postMessage/onmessage
 */
export const GetWorkerContext =  async (): Promise<Worker> => {

  let ctx: Worker;

  if (in_process_worker_context) {
    ctx = in_process_worker_context as unknown as Worker;
  }
  else if (typeof self === 'undefined') {
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