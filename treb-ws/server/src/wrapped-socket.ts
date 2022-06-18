
import { WebSocket } from 'ws';
import { CalculationDataMessage, CommandLogMessage, FullModelMessage, LeaderAssignmentMessage } from './message-type';

export class WrappedSocket {

  constructor(public id: number, public socket: WebSocket) {
    // ...
  }

  /**
   * this is a strict version. however it's not really necessary to 
   * decode and reencode every time, so we have a sloppy version.
   */
  public ResendMessage(message: FullModelMessage|CommandLogMessage|CalculationDataMessage) {
    this.socket.send(JSON.stringify(message));
  }

  /** sloppy version. it's not that bad as long as we test first. */
  public Resend(message: string) {
    this.socket.send(message);
  }

  public SendLeaderAssignment(leader = true) {
    const message: LeaderAssignmentMessage = {
      type: 'leader-assignment',
      leader,
    };
    this.socket.send(JSON.stringify(message));
  }

  public SendFullModelRequest() {
    const message: FullModelMessage = {
      type: 'full-model',
      request: true,
    };
    this.socket.send(JSON.stringify(message));
  }


}
