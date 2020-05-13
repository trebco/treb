
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

  public smoothing_factor = 0.2;

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

  /** specialization for bar; it's different enough that we want special treatment */
  public RenderXAxisBar(
    area: Area,
    offset: boolean,
    labels: string[],
    metrics: Metrics[],
    classes?: string|string[]) {

  const count = labels.length;
  if (!count) return;

  // FIXME: base on font, ' ' character
  const label_buffer = 4;

  const step = offset ? area.width / count : area.width / (count - 1);
  const initial_offset = offset ? (step / 2) : 0;

  // calculate increment (skip_count)
  let increment = 1;
  let repeat = true;

  while (repeat) {
    repeat = false;
    let extent = 0;
    for (let i = 0; i < count; i += increment) {
      const center = Math.round(area.left + initial_offset + step * i);
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
    const x = Math.round(area.left + initial_offset + step * i);
    // if (x + metrics[i].width / 2 >= area.right) { break; }
    this.RenderText(labels[i], 'center', { x, y: area.bottom }, classes);
  }

}

  /**
   * render x axis labels; skips over labels to prevent overlap
   */
  public RenderXAxis(
      area: Area,
      offset: boolean,
      labels: string[],
      metrics: Metrics[],
      classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    // FIXME: base on font, ' ' character
    const label_buffer = 4;

    const step = offset ? area.width / count : area.width / (count - 1);
    const initial_offset = offset ? (step / 2) : 0;

    // calculate increment (skip_count)
    let increment = 1;
    let repeat = true;

    while (repeat) {
      repeat = false;
      let extent = 0;
      for (let i = 0; i < count; i += increment) {
        const center = Math.round(area.left + initial_offset + step * i);
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
      const x = Math.round(area.left + initial_offset + step * i);
      // if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(labels[i], 'center', { x, y: area.bottom }, classes);
    }

  }

  /** specialization for bar; it's different enough that we want special treatment */
  public RenderYAxisBar(area: Area, left: number,
    labels: Array<{
      label: string; 
      metrics: Metrics;
    }>, classes?: string|string[]) {

    const count = labels.length;
    if (!count) return;

    const step = area.height / count;

    // calculate increment (skip count)
    let increment = 1;
    let repeat = true;

    while(repeat) {
      repeat = false;
      let extent = 0;
      for (let i = 0; i < count; i += increment) {
        const label = labels[i];
        const y = Math.round(area.bottom - step * (i + .5) + label.metrics.height / 4);
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
      const y = Math.round(area.bottom - step * (i + .5) + label.metrics.height / 4);
      this.RenderText(label.label, 'right', { x: left, y }, classes);
    }

  }

  /**
   * render y axis labels; skips over labels to prevent overlap
   */
  public RenderYAxis(area: Area, left: number,
    labels: Array<{
      label: string; 
      metrics: Metrics;
    }>, classes?: string|string[]) {

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

  public ControlPoint(current: Point, previous?: Point, next?: Point, reverse = false): Point {

    previous = previous || current;
    next = next || current;

    const o = this.LineProperties(previous, next);
    const factor = Math.pow(1 - Math.abs(o.angle)/Math.PI, 2) * this.smoothing_factor;

    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * factor;
    
    const x = current.x + Math.cos(angle) * length;
    const y = current.y + Math.sin(angle) * length;
  
    return {x, y};

  }

  public LineProperties(a: Point, b: Point) {

    const x = b.x - a.x;
    const y = b.y - a.y;

    return {
      length: Math.sqrt((x * x) + (y * y)),
      angle: Math.atan2(y, x),
    };

  }

  public RenderSmoothLine(      
    area: Area,
    data: Array<number|undefined>,
    fill = false,
    titles?: string[],
    classes?: string|string[]) {


    // const node = document.createElementNS(SVGNS, 'path');
    const group = document.createElementNS(SVGNS, 'g');

    const d1: string[] = [];
    const d2: string[] = [];

    const count = data.length;
    const steps = count - 1;
    const step = (area.width / count) / 2;

    const circles: Array<{
      x: number;
      y: number;
      i: number;
    }> = [];

    let move = true;
    let last_x: number|undefined;

    let last_point: Point|undefined;

    const points: Array<Point|undefined> = data.map((value, i) => {
      if (typeof value === 'undefined') { 
        return undefined;
      }
      return {
        x: Math.round(area.left + area.width / steps * i),
        y: area.bottom - value,
      };
    });

    for (let i = 0; i < points.length; i++) {

      const point = points[i];

      if (point) {
        if (move) {
          d1.push(`M ${[point.x]},${point.y}`);
          if (fill) {
            d2.push(`M ${point.x} ${area.bottom} L ${[point.x]},${point.y}`);
          }
        }
        else {
          const cp_start = this.ControlPoint(points[i-1] as Point, points[i-2], point);
          const cp_end = this.ControlPoint(point, points[i-1], points[i+1], true);
          d1.push(`C ${cp_start.x},${cp_start.y} ${cp_end.x},${cp_end.y} ${point.x},${point.y}`);
          d2.push(`C ${cp_start.x},${cp_start.y} ${cp_end.x},${cp_end.y} ${point.x},${point.y}`);
        }
        move = false;
        last_point = point;

      }
      else {
        move = true;
        if (fill && last_point) {
          d2.push(`L ${last_point.x},${area.bottom} Z`);
        }
        last_point = undefined;
      }

    }

    if (fill && last_point) {
      d2.push(`L ${last_point.x},${area.bottom} Z`);
    }


    /*

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
      const x = Math.round(area.left + area.width / steps * i);
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

      circles.push({x, y: area.bottom - point, i});

      last_x = x;
      move = false;
    }

    */

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

    // circles...

    if (titles && circles.length) {
      const circle_group = document.createElementNS(SVGNS, 'g');
      for (const circle of circles) {
        const shape = document.createElementNS(SVGNS, 'circle');
        shape.setAttribute('cx', circle.x.toString());
        shape.setAttribute('cy', circle.y.toString());
        shape.setAttribute('r', (step).toString());

        shape.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', titles[circle.i] || '');
        });
        shape.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });

        circle_group.appendChild(shape);
        circle_group.classList.add('mouse-layer');
      }
      this.group.appendChild(circle_group);

    }
  }

  public RenderLine(
      area: Area,
      data: Array<number|undefined>,
      fill = false,
      titles?: string[],
      classes?: string|string[] ){

    // const node = document.createElementNS(SVGNS, 'path');
    const group = document.createElementNS(SVGNS, 'g');

    const d1: string[] = [];
    const d2: string[] = [];

    const count = data.length;
    const steps = count - 1;
    const step = (area.width / count) / 2;

    const circles: Array<{
      x: number;
      y: number;
      i: number;
    }> = [];

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
      const x = Math.round(/*step*/ + area.left + area.width / steps * i);
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

      circles.push({x, y: area.bottom - point, i});

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

    // circles...

    if (titles && circles.length) {
      const circle_group = document.createElementNS(SVGNS, 'g');
      for (const circle of circles) {
        const shape = document.createElementNS(SVGNS, 'circle');
        shape.setAttribute('cx', circle.x.toString());
        shape.setAttribute('cy', circle.y.toString());
        shape.setAttribute('r', (step).toString());

        shape.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', titles[circle.i] || '');
        });
        shape.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });

        circle_group.appendChild(shape);
        circle_group.classList.add('mouse-layer');
      }
      this.group.appendChild(circle_group);

    }

  }

  /**
   * the other RenderGrid function has semantics specifically for area/line.
   * rather than try to shoehorn this in we'll use a different method.
   */
  public RenderBarGrid(area: Area, x_count: number, classes?: string|string[]) {
   
    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    const step = area.width / (x_count);
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

  public RenderGrid(area: Area, y_count: number, x_count = 0, classes?: string|string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    let step = area.height / y_count;
    for (let i = 0; i <= y_count; i++ ){
      const y = Math.round(area.top + step * i) - 0.5;
      d.push(`M${area.left} ${y} L${area.right} ${y}`);
    }

    step = area.width / (x_count - 1);
    for (let i = 0; i < x_count; i++ ){
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
      bounds_area: Area,
      callouts: boolean,
      classes?: string|string[] ) {

    let start_angle = -Math.PI / 2; // start at 12:00
    let end_angle = 0;

    if (callouts) {
      outer_radius *= .8;
      inner_radius *= .7;
    }

    // we're creating a containing group so that we can nth-child the slices,
    // otherwise they'll be in the same group as the title

    const donut = document.createElementNS(SVGNS, 'g');

    for (const slice of slices) {

      const title = slice.title || '';

      const value = slice.percent;
      const index = slice.index;

      const node = document.createElementNS(SVGNS, 'path');
      let d: string[] = [];

      let half_angle = 0;

      if (value > 0.5) {
        // split into two segments

        half_angle = start_angle + (value / 2) * Math.PI * 2;
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
        half_angle = (end_angle - start_angle) / 2 + start_angle;

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

      /*
      if (title) {
        node.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', title);
        });
        node.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });
      }
      */

      donut.appendChild(node);

      if (/*callouts &&*/ value >= .05 && title){

        const callout = document.createElementNS(SVGNS, 'path');
        const length = outer_radius - inner_radius;
        d = [];

        const anchor = this.PointOnCircle(half_angle, center,
          inner_radius + (outer_radius - inner_radius) / 2 + length);

        d.push(`M${this.PointOnCircle(half_angle, center, inner_radius + (outer_radius - inner_radius) / 2)}`);
        d.push(`L${anchor}`);
        callout.setAttribute('d', d.join(' '));
        callout.classList.add('callout');
        donut.appendChild(callout);

        const corrected = half_angle + Math.PI / 2;

        const text = title;
        const metrics = this.MeasureText(text, ['donut', 'callout-label']);
        let [x, y] = anchor;

        x += metrics.height / 2 * Math.cos(half_angle);
        y += metrics.height / 4 + metrics.height / 2 * Math.sin(half_angle);

        let try_break = false;

        if (corrected > Math.PI) {
          if (x - metrics.width <= bounds_area.left) {
            try_break = true;
          }
        }
        else {
          if (x + metrics.width > bounds_area.right) {
            try_break = true;
          }
        }

        const text_parts: string[] = [];
        const callout_label = document.createElementNS(SVGNS, 'text');
        callout_label.classList.add('callout-label');

        const break_regex = /[\s-\W]/;

        if (try_break && break_regex.test(text)) {
          let break_index = -1;
          let break_value = 1;

          const indices: number[] = [];
          for (let i = 0; i < text.length; i++) {
            if (break_regex.test(text[i])) {
              const index_value = Math.abs(0.5 - (i / text.length));
              if (index_value < break_value) {
                break_value = index_value;
                break_index = i;
              }
            }
          }

          if (break_index > 0) {
            text_parts.push(text.substr(0, break_index + 1).trim());
            text_parts.push(text.substr(break_index + 1).trim());
          }
        }
        else {
          // ... ellipsis?
        }

        /*
        if (y <= bounds_area.top) {
          console.info("break top", title, y);
        }
        if (y >= bounds_area.bottom) {
          console.info("break bottom", title, y);
        }
        */

        if (text_parts.length) {
          let dy = 0;
          let widest = 0;

          const parts = text_parts.map((part) => {
            const m = this.MeasureText(part, ['donut', 'callout-label']);
            widest = Math.max(widest, m.width);
            return {text: part, metrics: m};
          });

          for (const part of parts) {
            const tspan = document.createElementNS(SVGNS, 'tspan');
            tspan.textContent = part.text;

            const part_x = (corrected > Math.PI) ?
              (x - (widest - part.metrics.width) / 2) :
              (x + (widest - part.metrics.width) / 2);

            tspan.setAttribute('x', part_x.toString());
            tspan.setAttribute('dy', dy.toString());

            callout_label.appendChild(tspan);
            dy = part.metrics.height;

          }
        }
        else {
          callout_label.textContent = title;
        }

        const text_anchor = corrected > Math.PI ? 'end' : 'start';
        callout_label.setAttribute('text-anchor', text_anchor);

        callout_label.setAttribute('x', x.toString());
        callout_label.setAttribute('y', y.toString());
        donut.appendChild(callout_label);

      }

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
