
import { Area, Size, Point } from './rectangle';

const SVGNS = 'http://www.w3.org/2000/svg';

export interface Metrics {
  width: number;
  height: number;
  y_offset: number;
}

/**
 * FIXME: normalize API, make canvas version
 */
export class ChartRenderer {

  public parent!: HTMLElement;
  public svg_node!: SVGElement;
  public group!: SVGGElement;
  public text_measurement_node?: SVGTextElement;

  public size: Size = { width: 0, height: 0 };
  public bounds: Area = new Area();

  public Initialize(node: HTMLElement) {
    this.parent = node;
    this.svg_node = document.createElementNS(SVGNS, 'svg');
    this.svg_node.setAttribute('class', 'treb-chart');
    this.svg_node.style.overflow = 'hidden';
    this.svg_node.style.position = 'relative';
    this.svg_node.style.width = '100%';
    this.svg_node.style.height = '100%';

    this.group = document.createElementNS(SVGNS, 'g');
    this.svg_node.appendChild(this.group);

    // FIXME: validate parent is relative/absolute

    this.parent.appendChild(this.svg_node);
    this.Resize();
  }

  public Clear() {
    this.group.textContent = '';
  }

  public Resize() {
    const bounds = this.parent.getBoundingClientRect();
    this.svg_node.setAttribute('width', bounds.width.toString());
    this.svg_node.setAttribute('height', bounds.height.toString());
    this.size = {
      width: bounds.width,
      height: bounds.height,
    };
  }

  /**
   * initialize before render. this assumes that document layout/scroll
   * won't change during the render pass, so we can cache some values.
   */
  public Prerender() {
    const bounds = this.svg_node.getBoundingClientRect();
    this.bounds.top = bounds.top;
    this.bounds.left = bounds.left;
    this.bounds.right = bounds.right;
    this.bounds.bottom = bounds.bottom;
  }

  /**
   * measure a label, optionally with class name(s)
   */
  public MeasureText(label: string, classes?: string|string[], ceil = false): Metrics {

    if (!this.text_measurement_node) {
      this.text_measurement_node = document.createElementNS(SVGNS, 'text');
      this.text_measurement_node.setAttribute('x', '-100px');
      this.text_measurement_node.setAttribute('y', '-100px');
      this.svg_node.appendChild(this.text_measurement_node);
    }

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      this.text_measurement_node.setAttribute('class', classes.join(' '));
    }
    else {
      this.text_measurement_node.setAttribute('class', '');
    }

    this.text_measurement_node.textContent = label;

    const bounds = this.text_measurement_node.getBoundingClientRect();

    const metrics = {
      width: bounds.width,
      height: bounds.height,
      y_offset: bounds.height - ((this.bounds.top - bounds.top) - 100),
    };

    if (ceil) {
      metrics.width = Math.ceil(metrics.width);
      metrics.height = Math.ceil(metrics.height);
      metrics.y_offset = Math.ceil(metrics.y_offset);
    }

    return metrics;
  }

  public RenderTicks(area: Area, 
    top: number, bottom: number, count: number, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    const step = area.width / (count);
    for (let i = 0; i < count; i++){
      const center = Math.round(area.left + step / 2 + step * i) - 0.5;
      d.push(`M${center} ${top} L${center} ${bottom}`);
    }

    node.setAttribute('d', d.join(' '));

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    this.group.appendChild(node);

  }

  public RenderXAxis(area: Area,
      labels: string[],
      metrics: Metrics[],
      classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    const step = area.width / (count);

    // calculate skip count
    let skip_count = 0;
    let repeat = true;
    while (repeat) {
      repeat = false;
      let extent = 0;
      for (let i = 0; i < count; i += (skip_count + 1)){
        const center = Math.round(area.left + step / 2 + step * i);
        const left = center - metrics[i].width / 2;
        if (extent && (left <= extent)) {
          skip_count++;
          repeat = true;
          break;
        }
        extent = center + metrics[i].width / 2;
      }
    }

    // now render, with skips -- stop at bounds
    for (let i = 0; i < count; i += (skip_count + 1)){
      const center = Math.round(area.left + step / 2 + step * i);
//      const extent = center + metrics[i].width / 2;
//      if (extent < area.right) {
        this.RenderText(labels[i], 'center', {
          x: center, y: area.bottom, }, classes);
//      }
    }

  }

  public RenderYAxis(area: Area, left: number,
    labels: Array<{label: string, metrics: Metrics}>, classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    const step = area.height / (count - 1);
    for (let i = 0; i < count; i++) {
      const y = Math.round(area.bottom - step * i);
      const label = labels[i];
      this.RenderText(label.label, 'right', {
        x: left,
        y: Math.round(y + (label.metrics.height / 4)),
      }, classes);
    }

  }

  public RenderGrid(area: Area, y_count: number, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    const step = area.height / y_count;
    for (let i = 0; i <= y_count; i++ ){
      const y = Math.round(area.top + step * i) - 0.5;
      d.push(`M${area.left} ${y} L${area.right} ${y}`);
    }

    node.setAttribute('d', d.join(' '));

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    this.group.appendChild(node);

  }

  public RenderPoints(area: Area, x: number[], y: number[], classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    for (let i = 0; i < x.length; i++ ){
      const px = x[i] * area.width + area.left;
      const py = area.bottom - y[i] * area.height;
      d.push(`M${px - 1},${py - 1} L${px + 1},${py + 1}`);
      d.push(`M${px - 1},${py + 1} L${px + 1},${py - 1}`);
    }

    // console.info(d);
    node.setAttribute('d', d.join(' '));

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    // if (title) node.setAttribute('title', title);
    this.group.appendChild(node);
    
  }

  public RenderPoint(x: number, y: number, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'circle');
    node.setAttribute('cx', x.toString());
    node.setAttribute('cy', y.toString());
    node.setAttribute('r', '1');

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    // if (title) node.setAttribute('title', title);
    this.group.appendChild(node);
  }

  public RenderRectangle(area: Area, classes?: string|string[], title?: string) {

    const node = document.createElementNS(SVGNS, 'rect');
    node.setAttribute('x', area.left.toString());
    node.setAttribute('y', area.top.toString());
    node.setAttribute('width', area.width.toString());
    node.setAttribute('height', area.height.toString());

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    if (title) node.setAttribute('title', title);
    this.group.appendChild(node);
  }

  /**
   * render text at point
   */
  public RenderText(text: string, align: 'center'|'left'|'right', point: Point, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'text');
    node.textContent = text;

    switch (align) {
      case 'right':
        node.style.textAnchor = 'end';
        break;

      case 'center':
        node.style.textAnchor = 'middle';
        break;

      default:
        node.style.textAnchor = 'start';
        break;
    }

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      node.setAttribute('class', classes.join(' '));
    }

    node.setAttribute('x', point.x.toString());
    node.setAttribute('y', point.y.toString());

    this.group.appendChild(node);

  }

}
