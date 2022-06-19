
import { WSServer } from './server';

let port = 9001;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--port') {
    port = Number(process.argv[++i]);
  }
}

new WSServer(port);

