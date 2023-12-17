
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


