
/**
 * async event source
 */
export interface IEventSource<T> {

  /** subscribe. returns a token (number) used to manage the subscription. */
  Subscribe(subscriber: (event: T) => void): number;

  /** cancel a single subscription */
  Cancel(token: number): void;

}
