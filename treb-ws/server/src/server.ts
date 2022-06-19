
import { WebSocket, WebSocketServer } from 'ws';
import { Message } from './message-type';
import { WrappedSocket } from './wrapped-socket';

export class WSServer {

  protected id_generator = 100;

  /** socket server */
  protected wss: WebSocketServer;

  /** log timeout in seconds */
  protected log_timeout = 5 * 60;

  /** leader ID */
  protected leader = -1;

  /** current connections */
  protected connections: Map<number, WrappedSocket> = new Map();
  
  constructor(port) {

    // create server
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', socket => this.Connect(socket));

    // start log loop
    this.LogStatsLoop(true);

  }

  /**
   * handle new connection, set up event handlers
   */
  public Connect(socket: WebSocket): void {

    const id = this.id_generator++;
    const wrapped = new WrappedSocket(id, socket);
    this.connections.set(id, wrapped);
    
    this.Log(`new connection: ${id}`);

    // on close, clean up; we may have to reassign the leader.

    socket.on('close', (code: number, reason: Buffer) => {
      this.Log(`close socket ${id} ${code} ${reason}`);
      this.connections.delete(id);
      if (id === this.leader) {
        this.leader = -1;
        const replacement = this.connections.values().next();
        if (!replacement.done) {
          this.leader = replacement.value.id;
          replacement.value.SendLeaderAssignment(true);
          this.Log(`reassigning leader: ${this.leader}`);
        }
      }
    });

    // handle inbound message

    socket.on('message', data => {
      try {
        const text = data.toString('utf-8');
        const message = JSON.parse(text) as Message;

        // console.info("RX", message);

        switch (message.type) {

          // if any of these messages arrive from the client,
          // we want to broadcast to other clients. we could
          // lock down the full-model message, though.

          case 'calculation-data':
          case 'command-log':
          case 'full-model':
            Promise.resolve().then(() => {
              for (const connection of this.connections.values()) {
                if (connection !== wrapped) {
                  connection.Resend(text);
                }
              }
            });
            break;

          case 'request-recalculation':

            // this one should just go to the leader

            Promise.resolve().then(() => {
              const leader = this.connections.get(this.leader);
              if (leader) {
                leader.Resend(text);
              }
            });
            break;

        }
      }
      catch (err) {
        this.Log(err);
      }
    });

    // if this is the first connection, it's automatically the leader.
    // otherwise, we need a model refresh for the new follower.

    if (this.leader === -1) {
      this.leader = id;
      wrapped.SendLeaderAssignment(true);
      this.Log(`assigning leader: ${this.leader}`);
    }
    else {
      const leader = this.connections.get(this.leader);
      if (leader) {
        Promise.resolve().then(() => leader.SendFullModelRequest());
      }
    }

  }

  /** FIXME: proper log function */
  public Log(message: string) {
    console.info(`${new Date().toLocaleString()}: ${message}`);
  }
  
  /** display stats every few minutes */
  public LogStatsLoop(skip?: boolean) {
    if (!skip) {
      const count = this.connections.size;
      this.Log(`${count} open connection${count === 1 ? '' : 's'}`);
    }
    setTimeout(() => this.LogStatsLoop(), this.log_timeout * 1000);
  }

}


