
import { Yield } from './dispatch';
import { IEventSource } from './ievent_source';

let subscription_token_generator = 1000;

interface EventSubscription<T> {
  subscriber: (event: T) => any;
  token: number;
}

/**
 * relatively simple event publish/subscribe mechanism.
 * not as simple as it used to be.
 */
export class EventSource<T> implements IEventSource<T> {

  /** pending events */
  private queue: T[] = [];

  /** flag indicating whether we have already triggered a callback */
  private dispatched = false;

  /** regular subscriptions */
  private subscribers: Array<EventSubscription<T>> = [];

  /** pass-through modules: these are peers */
  private pass_through: Array<EventSource<T>> = [];

  /**
   * FIXME: does anybody call this with an array? it's no longer
   * necessary for multiple messages to prevent extra callbacks...
   */
  public Publish(event: T | T[]) {

    // here's our updated synchronous mechanism, passing through

    this.pass_through.forEach((source) => source.Publish(event));

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
    this.pass_through = [];
  }

  /**
   * pass-through (redirected) subscription, synchronous on this end. does
   * not support unsubscribe atm (FIXME)
   */
  public PassThrough(source: EventSource<T>) {
    this.pass_through.push(source);
  }

}


