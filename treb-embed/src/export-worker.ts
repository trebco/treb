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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

// this is a new entrypoint for the worker, as a module. while we can't 
// just create a worker script, if we create this as a module and embed
// the worker script we can still get the benefits of dynamic loading.

// why can't we create a worker script? it's OK for direct embedding but
// breaks when embedding in a bundler (vite is OK, but webpack is not).
// but all bundlers seem ok with local modules (knock on wood).

/**
 * import the worker as text so it will be embedded in this module
 */
import * as export_worker_script from 'worker:../../treb-export/src/index.worker';

/**
 * create the worker by loading the embedded text
 * @returns 
 */
export const CreateWorker = async (): Promise<Worker> => {
  const worker = new Worker(
    URL.createObjectURL(new Blob([(export_worker_script as {default: string}).default], { type: 'application/javascript' })));
  return worker;
};

