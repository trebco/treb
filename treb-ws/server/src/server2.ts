/**
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
 * Copyright 2022 trebco, llc. + info@treb.app
 */

import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'https';
import { CalculationDataMessage, Message } from './message-type';
import { WrappedSocket } from './wrapped-socket';
import { readFileSync } from 'fs';
import { parse } from 'url';

import { GridBase, DataModel, Sheet, CommandKey, GridEvent, SerializeOptions } from 'treb-grid';
import { Calculator } from 'treb-calculator';
import { Parser } from 'treb-parser';
import { Area } from 'treb-base-types';

export class WSServer {

  protected id_generator = 100;

  /** socket server */
  protected wss: WebSocketServer;

  /** log timeout in seconds */
  protected log_timeout = 5 * 60;

  /** leader ID */
  // protected leader = -1;

  /** current connections */
  protected connections: Map<number, WrappedSocket> = new Map();
  
  public parser = new Parser();
  public model = new DataModel();

  public calculator: Calculator;
  public grid: GridBase;

  constructor(port: number) {

    this.model.sheets.Add(Sheet.Blank(this.model.theme_style_properties));
    this.grid = new GridBase({
      add_tab: true,
      delete_tab: true,
      expand: true,
    }, this.parser, this.model);
    this.calculator = new Calculator(this.model);

    this.grid.grid_events.Subscribe(event => {

      // console.info(event);

      switch (event.type) {
        case 'data':
          this.Recalculate(event);
          break;

        case 'structure':
          if (event.rebuild_required) {
            this.calculator.Reset();
            this.Recalculate(event);
          }
          break;
      }
    });

    this.Log(`starting server on port ${port}`);

    // create server
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', socket => this.Connect(socket));

    // start log loop
    this.LogStatsLoop(true);

  }

  public SerializeDocument(options: SerializeOptions = {}) {

    // API v1 OK

    // add default for shrink, which can be overridden w/ explicit false

    const grid_data = this.grid.Serialize({
      shrink: true, ...options,
    });

    // NOTE: these are not really env vars. we replace them at build time
    // via a webpack plugin. using the env syntax lets them look "real" at
    // analysis time. got that trick from svelte.

    const serialized = {
      // app: process.env.BUILD_NAME || '',
      // version: process.env.BUILD_VERSION || '',
      // revision: this.file_version,
      name: this.grid.model.document_name, // may be undefined
      user_data: this.grid.model.user_data, // may be undefined
      decimal_mark: '.',
      ...grid_data,
      rendered_values: options.rendered_values,
    };

    return serialized;

  }


  public async Recalculate(event?: GridEvent): Promise<void> {

    // API v1 OK

    let area: Area | undefined;
    if (event && event.type === 'data' && event.area) {
      area = event.area;
    }

    this.calculator.Calculate(area);

    // this.grid.Update(true); // , area);
    // this.UpdateAnnotations();
    // this.Publish({ type: 'data' });

    const message: CalculationDataMessage = {
      type: 'calculation-data',
      data: this.calculator.ExportCalculatedValues(),
    };

    const json = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      connection.Resend(json);
    }
  
    console.info(JSON.stringify(this.grid.Serialize({
      rendered_values: true,
    }), undefined, 2));

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

          /*
          case 'calculation-data':
          case 'full-model':
            Promise.resolve().then(() => {
              for (const connection of this.connections.values()) {
                if (connection !== wrapped) {
                  connection.Resend(text);
                }
              }
            });
            break;
          */

          case 'command-log':
            // console.info(message);
            this.grid.ExecCommand(message.data?.command || [], false);

            // Promise.resolve().then(() => {
              for (const connection of this.connections.values()) {
                if (connection !== wrapped) {
                  connection.Resend(text);
                }
              }
            //});
            break;
    
          case 'request-recalculation':
            this.Recalculate();

            /*
            // this one should just go to the leader

            Promise.resolve().then(() => {
              const leader = this.connections.get(this.leader);
              if (leader) {
                leader.Resend(text);
              }
            });
            */
            break;

        }
      }
      catch (err) {
        this.Log(err);
      }
    });

    wrapped.ResendMessage({
      type: 'full-model',
      response: true,
      data: this.SerializeDocument(),
    })

    /*
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
    */

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


