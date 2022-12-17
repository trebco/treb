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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import { Yield } from './dispatch';
// import { IEventSource } from './ievent_source';

let subscription_token_generator = 1000;

interface EventSubscription<T> {
  subscriber: (event: T) => any;
  token: number;
}

/**
 * relatively simple event publish/subscribe mechanism.
 * not as simple as it used to be.
 * 
 * UPDATE removing unecessary interface (not sure what that
 * was for, but no one else is using it).
 */
export class EventSource<T> { // implements IEventSource<T> {

  /** pending events */
  private queue: T[] = [];

  /** flag indicating whether we have already triggered a callback */
  private dispatched = false;

  /** regular subscriptions */
  private subscribers: Array<EventSubscription<T>> = [];

  /* * pass-through modules: these are peers * /
  private pass_through: Array<EventSource<T>> = [];
  */

  constructor(private verbose = false, private log_id?: string) {

  }

  /**
   * FIXME: does anybody call this with an array? it's no longer
   * necessary for multiple messages to prevent extra callbacks...
   */
  public Publish(event: T | T[]) {

    if (this.verbose) {
      console.info(`es publish (${this.log_id})`, event);
    }

    // here's our updated synchronous mechanism, passing through
    // FIXME: no one uses this (I think). drop it.

    // this.pass_through.forEach((source) => source.Publish(event));

    // don't bother if there are no subscribers (implies you must
    // subscribe before first event... not sure if that's reasonable)

    /*
    if (!this.subscribers.length) {
      return; // ...
    }
    */

    // queue event or events

    if (Array.isArray(event)) { this.queue.push(...event); }
    else { this.queue.push(event); }

    // then call the dispatch function. gate this in case we get
    // this call multiple times before a callback.

    if (!this.dispatched) {
      this.dispatched = true;

      Yield().then(() => {

        const events = this.queue.slice(0);
        this.dispatched = false;
        this.queue = [];

        // FIXME: should we cache subscribers as well? (...)

        for (const queued_event of events) {
          for (const subscription of this.subscribers) {
            subscription.subscriber(queued_event);
          }
        }

      });

    }

  }

  /**
   * subscription returns a token which can be used to cancel subscription.
   * this token is a number, guaranteed to be !0 so you can test for falsy.
   */
  public Subscribe(subscriber: (event: T) => void): number {
    const token = subscription_token_generator++;
    this.subscribers.push({ subscriber, token });
    return token;
  }

  /** cancel a single subscription */
  public Cancel(token: number) {
    this.subscribers = this.subscribers.filter((subscription) => subscription.token !== token);
  }

  /**
   * cancel all subscriptions AND ALL PASS-THROUGH SOURCES.
   */
  public CancelAll() {
    this.subscribers = [];
    // this.pass_through = [];
  }

  /* *
   * pass-through (redirected) subscription, synchronous on this end. does
   * not support unsubscribe atm (FIXME)
   * /
  public PassThrough(source: EventSource<T>) {
    this.pass_through.push(source);
  }
  */

}


