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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

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
