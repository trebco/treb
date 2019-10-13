
import { Area, Size, Point } from './rectangle';
import { DonutSlice } from './chart-types';

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

  /**
   * render x axis labels; skips over labels to prevent overlap
   */
  public RenderXAxis(
      area: Area,
      labels: string[],
      metrics: Metrics[],
      classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    // FIXME: base on font, ' ' character
    const label_buffer = 4;

    const step = area.width / (count);

    // calculate increment (skip_count)
    let increment = 1;
    let repeat = true;

    while (repeat) {
      repeat = false;
      let extent = 0;
      for (let i = 0; i < count; i += increment) {
        const center = Math.round(area.left + step / 2 + step * i);
        const left = center - metrics[i].width / 2;
        if (extent && (left <= extent)) {
          increment++;
          repeat = true;
          break;
        }

        // FIXME: buffer? they get pretty tight sometimes

        extent = center + (metrics[i].width / 2) + label_buffer;
      }
    }

    for (let i = 0; i < count; i += increment) {
      const x = Math.round(area.left + step / 2 + step * i);
      if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(labels[i], 'center', { x, y: area.bottom }, classes);
    }

  }

  /**
   * render y axis labels; skips over labels to prevent overlap
   */
  public RenderYAxis(area: Area, left: number,
    labels: Array<{label: string, metrics: Metrics}>, classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    const step = area.height / (count - 1);

    // calculate increment (skip count)
    let increment = 1;
    let repeat = true;

    while(repeat) {
      repeat = false;
      let extent = 0;
      for (let i = 0; i < count; i += increment) {
        const label = labels[i];
        const y = Math.round(area.bottom - step * i + label.metrics.height / 4);
        if (extent && y >= extent) {
          increment++;
          repeat = true;
          break;
        }
        extent = y - label.metrics.height;
      }
    }

    for (let i = 0; i < count; i += increment) {
      const label = labels[i];
      const y = Math.round(area.bottom - step * i + label.metrics.height / 4);
      this.RenderText(label.label, 'right', { x: left, y }, classes);
    }

  }

  public RenderLine(area: Area, data: Array<number|undefined>, fill = false, classes?: string|string[]){

    // const node = document.createElementNS(SVGNS, 'path');
    const group = document.createElementNS(SVGNS, 'g');

    const d1: string[] = [];
    const d2: string[] = [];

    const count = data.length;
    const steps = count;
    const step = (area.width / count) / 2;

    let i = 0;
    let move = true;
    let last_x: number|undefined;

    for (; i < count; i++ ){
      const point = data[i];
      if (typeof point === 'undefined') {
        move = true;
        if (fill && (typeof last_x !== 'undefined')) {
          d2.push(`L${last_x} ${area.bottom}Z`);
        }
        last_x = undefined;
        continue;
      }
      const x = Math.round(step + area.left + area.width / steps * i);
      if (move) {
        if (fill) {
          d2.push(`M${x} ${area.bottom} L${x} ${area.bottom - point}`);
        }
        d1.push(`M${x} ${area.bottom - point}`);
      }
      else {
        d1.push(`L${x} ${area.bottom - point}`);
        d2.push(`L${x} ${area.bottom - point}`);
      }
      last_x = x;
      move = false;
    }

    if (fill && (typeof last_x !== 'undefined')) {
      d2.push(`L${last_x} ${area.bottom}Z`);
    }

    // fill first, under line

    if (fill) {
      const p2 = document.createElementNS(SVGNS, 'path');
      p2.setAttribute('d', d2.join(' '));
      p2.setAttribute('class', 'fill');
      group.appendChild(p2);
    }

    // then line

    const p1 = document.createElementNS(SVGNS, 'path');
    p1.setAttribute('d', d1.join(' '));
    p1.setAttribute('class', 'line');
    group.appendChild(p1);

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      group.setAttribute('class', classes.join(' '));
    }

    this.group.appendChild(group);

  }

  public RenderGrid(area: Area, y_count: number, x_count = 0, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    let step = area.height / y_count;
    for (let i = 0; i <= y_count; i++ ){
      const y = Math.round(area.top + step * i) - 0.5;
      d.push(`M${area.left} ${y} L${area.right} ${y}`);
    }

    step = area.width / x_count;
    for (let i = 0; i <= x_count; i++ ){
      const x = Math.round(area.left + step * i) - 0.5;
      d.push(`M${x} ${area.top} L${x} ${area.bottom}`);
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

    if (title) {
      node.addEventListener('mouseenter', (event) => {
        this.parent.setAttribute('title', title);
      });
      node.addEventListener('mouseleave', (event) => {
        this.parent.setAttribute('title', '');
      });
    }
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

  /**
   * render a donut, given a list of slices (as %)
   * @param values
   */
  public RenderDonut(
      slices: DonutSlice[],
      center: Point,
      outer_radius: number,
      inner_radius: number,
      classes?: string|string[]) {

    let start_angle = -Math.PI / 2; // start at 12:00
    let end_angle = 0;

    // we're creating a containing group so that we can nth-child the slices,
    // otherwise they'll be in the same group as the title

    const donut = document.createElementNS(SVGNS, 'g');

    for (const slice of slices) {

      const title = slice.title || '';

      const value = slice.percent;
      const index = slice.index;

      const node = document.createElementNS(SVGNS, 'path');
      const d: string[] = [];

      if (value > 0.5) {
        // split into two segments

        const half_angle = start_angle + (value / 2) * Math.PI * 2;
        end_angle = start_angle + value * Math.PI * 2;

        const delta1 = half_angle - start_angle;
        const delta2 = end_angle - half_angle;

        d.push(`M${this.PointOnCircle(start_angle, center, outer_radius)}`);
        d.push(`A${outer_radius},${outer_radius},${delta1},0,1,`
          + `${this.PointOnCircle(half_angle, center, outer_radius)}`);
        d.push(`A${outer_radius},${outer_radius},${delta2},0,1,`
          + `${this.PointOnCircle(end_angle, center, outer_radius)}`);
        d.push(`L${this.PointOnCircle(end_angle, center, inner_radius)}`)
        d.push(`A${inner_radius},${inner_radius},${delta2},0,0,`
          + `${this.PointOnCircle(half_angle, center, inner_radius)}`);
        d.push(`A${inner_radius},${inner_radius},${delta1},0,0,`
          + `${this.PointOnCircle(start_angle, center, inner_radius)}`);
        d.push('Z');

      }
      else {

        end_angle = start_angle + value * Math.PI * 2;
        const delta = end_angle - start_angle;
        d.push(`M${this.PointOnCircle(start_angle, center, outer_radius)}`);
        d.push(`A${outer_radius},${outer_radius},${delta},0,1,`
          + `${this.PointOnCircle(end_angle, center, outer_radius)}`);
        d.push(`L${this.PointOnCircle(end_angle, center, inner_radius)}`)
        d.push(`A${inner_radius},${inner_radius},${delta},0,0,`
          + `${this.PointOnCircle(start_angle, center, inner_radius)}`);
        d.push('Z');

      }

      node.setAttribute('d', d.join(' '));
      if (typeof index !== 'undefined') {
        node.classList.add(`series-${index}`);
      }

      if (title) {
        node.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', title);
        });
        node.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });
      }

      donut.appendChild(node);

      start_angle = end_angle;
    }

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      donut.setAttribute('class', classes.join(' '));
    }

    this.group.appendChild(donut);

  }

  protected PointOnCircle(angle: number, center: Point, radius: number) {
    return [
      Math.cos(angle) * radius + center.x,
      Math.sin(angle) * radius + center.y,
    ];
  }

}
