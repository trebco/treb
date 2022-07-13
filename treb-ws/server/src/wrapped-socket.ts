/**
 * 
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

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
