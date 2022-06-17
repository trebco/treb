
import type { LeafVertex } from './dag/leaf_vertex';
import type { Area } from 'treb-base-types';

export interface NotifierType {

  /** opaque user data */
  data?: any;

  /** function callback */
  callback?: (data?: any) => void;

}

export interface InternalNotifierType {

  /** 
   * assigned ID. this is (optionally) used for mamagement 
   */
  id: number;

  /** client */
  notifier: NotifierType;

  /** node */
  vertex: LeafVertex;

  /**  */
  state: number;

  /** 
   * we preserve our target ranges instead of the formula. this allows us
   * to survive sheet name changes, as well as to rebuild when the original
   * context sheet disappears.
   */
  references: Area[];
 

}
