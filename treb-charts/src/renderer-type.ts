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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */


import type { ChartData } from './chart-types'

/**
 * interface type for renderer
 */
export interface ChartRenderer {

  /**
   * set the target node. this is separate from rendering in the
   * event you want to cache or precalculate anything. it will be
   * called any time the node changes.
   */
  Initialize: (target: HTMLElement) => void;

  /**
   * called when the data has updated, you need to repaint the chart.
   * the node is passed as a conveniece, but you can cache the node
   * from Initialize().
   */
  Update: (target: HTMLElement, data: ChartData) => void;

  /**
   * called when the chart is resized. data has not changed. if you cached
   * the data previously, then you can reuse that. the node is passed as a 
   * conveniece, but you can cache the node from Initialize().
   */
  Resize: (target: HTMLElement, data: ChartData) => void;

}


