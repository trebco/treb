/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import { WSServer } from './server2';

let port = 9001;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--port') {
    port = Number(process.argv[++i]);
  }
}

new WSServer(port);

