
import { Area, Size, Point } from './rectangle';
import { DonutSlice, LegendLayout, LegendOptions, LegendPosition, LegendStyle } from './chart-types';
import { RangeScale } from 'treb-utils';

const SVGNS = 'http://www.w3.org/2000/svg';

export interface Metrics {
  width: number;
  height: number;
  y_offset: number;
}

const trident = /trident/i.test(navigator?.userAgent || '');

/*
let dom_parser: DOMParser | undefined;
const SetSVG = trident ? (node: SVGElement, svg: string) => {

  if (!dom_parser) {
    dom_parser = new DOMParser();
    (dom_parser as any).async = false;
  }

  const element = dom_parser.parseFromString(
    '<svg xmlns=\'http://www.w3.org/2000/svg\' xmlns:xlink=\'http://www.w3.org/1999/xlink\'>' + svg + '</svg>',
    'text/xml').documentElement;

  node.textContent = '';

  let child = element.firstChild;

  while (child) {
    node.appendChild(document.importNode(child, true));
    child = child.nextSibling;
  }

} : (node: SVGElement, svg: string) => node.innerHTML = svg;
*/

const SVGNode = (tag: string, attribute_map: {[index: string]: any} = {}, text?: string): SVGElement => {
  const node = document.createElementNS(SVGNS, tag);
  for (const key of Object.keys(attribute_map)) {
    if (attribute_map[key] !== undefined) {
      const value = attribute_map[key];
      node.setAttribute(key, Array.isArray(value) ? value.join(' ') : value.toString());
    }
  }
  if (text) { node.textContent = text; }
  return node;
};

/**
 * FIXME: normalize API, make canvas version
 */
export class ChartRenderer {

  public parent!: HTMLElement;
  public svg_node!: SVGElement;
  public text_measurement_node?: SVGTextElement;

  public container_group: SVGGElement;
  public group: SVGGElement;
  public axis_group: SVGGElement;
  public label_group: SVGGElement;

  public size: Size = { width: 0, height: 0 };
  public bounds: Area = new Area();

  // public smoothing_factor = 0.2;

  constructor() {
    this.container_group = SVGNode('g') as SVGGElement;

    this.group = SVGNode('g') as SVGGElement;
    this.axis_group = SVGNode('g', {class: 'axis-group'}) as SVGGElement;
    this.label_group = SVGNode('g', {class: 'label-group'}) as SVGGElement;

    this.container_group.appendChild(this.axis_group);
    this.container_group.appendChild(this.group);
    this.container_group.appendChild(this.label_group);
  }

  public Initialize(node: HTMLElement): void {
    this.parent = node;

    this.svg_node = SVGNode('svg', {
      class: 'treb-chart',
      // style: 'overflow: hidden; position: relative; width: 100%; height: 100%;'
    });
    this.svg_node.style.overflow = 'hidden';
    this.svg_node.style.position = 'relative';
    this.svg_node.style.width = '100%';
    this.svg_node.style.height = '100%';

    // this.group = document.createElementNS(SVGNS, 'g');
    this.svg_node.appendChild(this.container_group);

    // FIXME: validate parent is relative/absolute

    this.parent.appendChild(this.svg_node);
    this.Resize();
  }

  public Legend(options: LegendOptions): void {
    const group = SVGNode('g');
    this.group.appendChild(group);

    const measure = SVGNode('text');
    group.appendChild(measure);

    // IE says no
    // group.classList.add('legend');
    group.setAttribute('class', 'legend');

    const rows: number[][] = [[]];
    const padding = 10;
    let space = options.area.width;
    let row = 0;
    let max_height = 0;
    const width = options.area.width;

    const marker_width = (options.style === LegendStyle.marker) ? 14 : 26;

    const metrics = options.labels.map((label, index) => {
      measure.textContent = label;

      const text_rect = measure.getBoundingClientRect();
      const text_metrics = { width: text_rect.width, height: text_rect.height };
      const composite = text_metrics.width + marker_width + padding;

      max_height = Math.max(max_height, text_metrics.height);

      if (options.layout === LegendLayout.vertical) {
        rows[index] = [index];
      }
      else {
        if (composite > space) {
          if (rows[row].length === 0) {

            // there's nothing in this row, so moving to the next 
            // row will not help; stick it in here regardless

            rows[row].push(index);
            row++;
            rows[row] = [];
            space = width;
          }
          else {
            row++;
            rows[row] = [index];
            space = width - composite;
          }
        }
        else {
          rows[row].push(index);
          space -= composite;
        }
      }

      return text_metrics;
    });

    // IE11: SVG element doesn't have parent element? (...)

    // measure.parentElement?.removeChild(measure);
    group.removeChild(measure);

    let y = max_height;

    let layout = options.layout || LegendLayout.horizontal;
    if (layout === LegendLayout.horizontal && rows.every(row => row.length <= 1)) {
      layout = LegendLayout.horizontal;
    }

    for (let row = 0; row < rows.length; row++) {

      const row_width = rows[row].reduce((a, x) => a + metrics[x].width + marker_width, (rows[row].length - 1) * padding);

      let h = 0;
      let x = layout === LegendLayout.horizontal ?
        Math.round((width - row_width) / 2) :
        Math.round(padding / 2);

      for (let col = 0; col < rows[row].length; col++) {

        const index = rows[row][col];
        const text_metrrics = metrics[index];
        const label = options.labels[index];

        const marker_y = y - 1; // Math.round(y + text_metrrics.height / 2);

        // NOTE: trident offset is inlined here

        group.appendChild(SVGNode('text', {
          'dominant-baseline': 'middle', x: x + marker_width, y, dy: (trident ? '.3em' : undefined) }, label));

        if (options.style === LegendStyle.marker) {
          group.appendChild(SVGNode('rect', { 
            class: `series-${index + 1}`, x, y: marker_y - 4, width: 8, height: 8 }));
        }
        else {
          group.appendChild(SVGNode('rect', { 
            class: `series-${index + 1}`, x, y: marker_y - 1, width: marker_width - 3, height: 2}));
        }

        h = Math.max(h, text_metrrics.height);
        x += text_metrrics.width + marker_width + padding;

      }

      y = Math.round(y + h * 1.1);
    }

    const rect = group.getBoundingClientRect();
    const legend_size = { width: rect.width, height: rect.height + max_height };

    switch (options.position) {
      case LegendPosition.bottom:
        group.setAttribute('transform', `translate(${options.area.left}, ${options.area.bottom - legend_size.height})`);
        break;

      case LegendPosition.left:
        group.setAttribute('transform', `translate(${options.area.left}, ${options.area.top})`);
        break;

      case LegendPosition.right:
        group.setAttribute('transform', `translate(${options.area.right - legend_size.width}, ${options.area.top})`);
        break;

      case LegendPosition.top:
      default:
        group.setAttribute('transform', `translate(${options.area.left}, ${options.area.top})`);
    }

    if (options.position === LegendPosition.top) {
      options.area.top += legend_size.height || 0;
    }
    else if (options.position === LegendPosition.right) {
      options.area.right -= ((legend_size.width || 0) + 8); // 8?
    }
    else if (options.position === LegendPosition.left) {
      options.area.left += ((legend_size.width || 0) + 8);
    }
    else {
      options.area.bottom -= legend_size.height || 0;
    }

    // return legend_size;

  }

  public Clear(): void {
    this.group.textContent = '';
    this.axis_group.textContent = '';
    this.label_group.textContent = '';
  }

  public Resize(): void {
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
  public Prerender(): void {
    const bounds = this.svg_node.getBoundingClientRect();
    this.bounds.top = bounds.top;
    this.bounds.left = bounds.left;
    this.bounds.right = bounds.right;
    this.bounds.bottom = bounds.bottom;
  }

  /**
   * render title. this method modifies "area" in place -- that's 
   * the style we want to use going forward.
   * 
   * @param title 
   * @param area 
   * @param margin 
   * @param layout 
   */
  public RenderTitle(
      title: string,
      area: Area,
      margin: number,
      layout: 'top'|'bottom'): void {

    const text = SVGNode('text', {
      class: 'chart-title', 
      x: Math.round(area.width / 2), 
      // style: 'text-anchor: middle',
    }, title);
    text.style.textAnchor = 'middle';

    this.group.appendChild(text);
    const bounds = text.getBoundingClientRect();

    switch (layout) {
      case 'bottom':
        text.setAttribute('y', Math.round(area.bottom - bounds.height).toString());
        area.bottom -= (bounds.height + margin);
        break;

      default:
        text.setAttribute('y', Math.round(area.top + margin + bounds.height).toString());
        area.top += (bounds.height + margin);
        break;
    }
   
  }

  /**
   * measure a label, optionally with class name(s)
   * 
   * this is silly. you are doing the measurement on a random node and
   * trying to match classes, while you could just do the measurement on
   * the actual node, get actual classes right, and not bother with junk
   * nodes.
   * 
   * FIXME: decprecate
   * 
   */
  public MeasureText(label: string, classes?: string | string[], ceil = false): Metrics {

    if (!this.text_measurement_node) {
      this.text_measurement_node = SVGNode('text', { x: '-100px', y: '-100px' }) as SVGTextElement;
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

      // wtf is this?
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
    top: number, bottom: number, count: number, classes?: string | string[]) {

    const d: string[] = [];

    const step = area.width / (count);
    for (let i = 0; i < count; i++) {
      const center = Math.round(area.left + step / 2 + step * i) - 0.5;
      d.push(`M${center} ${top} L${center} ${bottom}`);
    }

    this.group.appendChild(SVGNode('path', {d, class: classes}));

  }

  /*
  public GetAxisNode(): SVGElement {
    if (!this.axis_group) { 
      this.axis_group = SVGNode('g', {class: 'axis-group'});
      this.group.appendChild(this.axis_group);
    }
    return this.axis_group; 
  }
  */

  /** specialization for bar; it's different enough that we want special treatment */
  public RenderXAxisBar(
    area: Area,
    offset: boolean,
    labels: string[],
    metrics: Metrics[],
    classes?: string | string[]): void {

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

    // const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const x = Math.round(area.left + initial_offset + step * i);
      // if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(this.axis_group, labels[i], 'center', { x, y: area.bottom }, classes);
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
    classes?: string | string[]): void {

    const count = labels.length;
    if (!count) return;

    // FIXME: base on font, ' ' character
    const label_buffer = 4;

    const step = offset ? area.width / count : area.width / (count - 1);
    const initial_offset = offset ? (step / 2) : 0;

    // calculate increment (skip_count)
    let increment = 1;
    let repeat = true;

    const f2 = (labels.length - 1) % 2 === 0;
    const f3 = (labels.length - 1) % 3 === 0;
    // const f5 = (labels.length - 1) % 5 === 0;

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

    // special patch for 0% - 100% range...

    if (increment === 3 && !f3 && f2) { 
      increment++; 
    }

    // const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const x = Math.round(area.left + initial_offset + step * i);
      // if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(this.axis_group, labels[i], 'center', { x, y: area.bottom }, classes);
    }

  }

  /** specialization for bar; it's different enough that we want special treatment */
  public RenderYAxisBar(area: Area, left: number,
    labels: Array<{
      label: string;
      metrics: Metrics;
    }>, classes?: string | string[]) {

    labels = labels.slice(0);
    labels.reverse();

    const count = labels.length;
    if (!count) return;

    const step = area.height / count;

    // calculate increment (skip count)
    let increment = 1;
    let repeat = true;

    while (repeat) {
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

    // const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const label = labels[i];
      const y = Math.round(area.bottom - step * (i + .5) + label.metrics.height / 4);
      this.RenderText(this.axis_group, label.label, 'right', { x: left, y }, classes);
    }

  }

  /**
   * render y axis labels; skips over labels to prevent overlap
   */
  public RenderYAxis(area: Area, left: number,
    labels: Array<{
      label: string;
      metrics: Metrics;
    }>, classes?: string | string[]) {

    const count = labels.length;
    if (!count) return;

    const step = area.height / (count - 1);

    // calculate increment (skip count)
    let increment = 1;
    let repeat = true;

    while (repeat) {
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

    // const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const label = labels[i];
      const y = Math.round(area.bottom - step * i + label.metrics.height / 4);
      this.RenderText(this.axis_group, label.label, 'right', { x: left, y }, classes);
    }

  }

  /*
  public ControlPoint(current: Point, previous?: Point, next?: Point, reverse = false): Point {

    previous = previous || current;
    next = next || current;

    const o = this.LineProperties(previous, next);
    const factor = Math.pow(1 - Math.abs(o.angle) / Math.PI, 2) * this.smoothing_factor;

    const angle = o.angle + (reverse ? Math.PI : 0);
    const length = o.length * factor;

    const x = current.x + Math.cos(angle) * length;
    const y = current.y + Math.sin(angle) * length;

    return { x, y };

  }
  */

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
    data: Array<number | undefined>,
    fill = false,
    titles?: string[],
    classes?: string | string[]): void {


    // const node = document.createElementNS(SVGNS, 'path');
    const group = SVGNode('g');

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

    const points: Array<Point | undefined> = data.map((value, i) => {
      if (typeof value === 'undefined') {
        return undefined;
      }
      return {
        x: Math.round(area.left + area.width / steps * i),
        y: area.bottom - value,
      };
    });

    ///

  
    // we need to split into segments in the event of missing data

    let segment: Point[] = [];
    const render_segment = () => {

      if (segment.length < 2){ return; }

      let line = '';
      const first = segment[0];
      const last = segment[segment.length-1];

      // note here we're not adding the leading M because for area,
      // we want to use an L instead (or it won't be contiguous)
      
      if (segment.length === 2) {
        line = `${segment[0].x},${segment[0].y} L${segment[1].x},${segment[1].y}`;
      }
      else if (segment.length > 2) {
        const curve = this.CatmullRomChain(segment);
        line = '' + curve.map(point => `${point.x},${point.y}`).join(' L');
      }

      if (line) {
        d1.push('M' + line);
        if (fill) { 
          d2.push(`M ${first.x},${area.bottom} L ${first.x},${first.y}`);
          d2.push('L' + line); 
          d2.push(`L ${last.x},${area.bottom}`);
        }
      }

    };

    for (const point of points) {
      if (!point) {
        render_segment();
        segment = [];
      }
      else {
        segment.push(point);
      }
    }
    // render?
    if (segment.length) {
      render_segment();
    }
    

    ///

    /*

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
          const cp_start = this.ControlPoint(points[i - 1] as Point, points[i - 2], point);
          const cp_end = this.ControlPoint(point, points[i - 1], points[i + 1], true);
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

    */

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

    /*
    if (fill && (typeof last_x !== 'undefined')) {
      d2.push(`L${last_x} ${area.bottom}Z`);
    }
    */

    // fill first, underneath
    if (fill) {
      group.appendChild(SVGNode('path', { class: 'fill', d: d2 }));
    }

    // then line
    group.appendChild(SVGNode('path', { class: 'line', d: d1 }));

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

        const shape = SVGNode('circle', {cx: circle.x, cy: circle.y, r: step});

        shape.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', titles[circle.i] || '');
        });
        shape.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });

        circle_group.appendChild(shape);
      }
      circle_group.setAttribute('class', 'mouse-layer');
      this.group.appendChild(circle_group);

    }
  }

  public RenderLine(
    area: Area,
    data: Array<number | undefined>,
    fill = false,
    titles?: string[],
    classes?: string | string[]) {

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
    let last_x: number | undefined;

    for (; i < count; i++) {
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

      circles.push({ x, y: area.bottom - point, i });

      last_x = x;
      move = false;
    }

    if (fill && (typeof last_x !== 'undefined')) {
      d2.push(`L${last_x} ${area.bottom}Z`);
    }

    // fill first, underneath
    if (fill) {
      group.appendChild(SVGNode('path', { class: 'fill', d: d2 }));
    }

    // then line
    group.appendChild(SVGNode('path', { class: 'line', d: d1 }));

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

        const shape = SVGNode('circle', { cx: circle.x, cy: circle.y, r: step });

        /*
        const shape = document.createElementNS(SVGNS, 'circle');
        shape.setAttribute('cx', circle.x.toString());
        shape.setAttribute('cy', circle.y.toString());
        shape.setAttribute('r', (step).toString());
        */

        shape.addEventListener('mouseenter', (event) => {
          this.parent.setAttribute('title', titles[circle.i] || '');
        });
        shape.addEventListener('mouseleave', (event) => {
          this.parent.setAttribute('title', '');
        });

        circle_group.appendChild(shape);
      }
      circle_group.setAttribute('class', 'mouse-layer');
      this.group.appendChild(circle_group);

    }

  }

  /**
   * the other RenderGrid function has semantics specifically for area/line.
   * rather than try to shoehorn this in we'll use a different method.
   */
  public RenderBarGrid(area: Area, x_count: number, classes?: string | string[]): void {

    const d: string[] = [];

    const step = area.width / (x_count);
    for (let i = 0; i <= x_count; i++) {
      const x = Math.round(area.left + step * i) - 0.5;
      d.push(`M${x} ${area.top} L${x} ${area.bottom}`);
    }

    this.group.appendChild(SVGNode('path', { d, class: classes }));

  }

  public RenderGrid(area: Area, y_count: number, x_count = 0, classes?: string | string[]): void {

    const d: string[] = [];

    let step = area.height / y_count;
    for (let i = 0; i <= y_count; i++) {
      const y = Math.round(area.top + step * i) - 0.5;
      d.push(`M${area.left} ${y} L${area.right} ${y}`);
    }

    step = area.width / (x_count - 1);
    for (let i = 0; i < x_count; i++) {
      const x = Math.round(area.left + step * i) - 0.5;
      d.push(`M${x} ${area.top} L${x} ${area.bottom}`);
    }

    this.group.appendChild(SVGNode('path', {d, class: classes}));

  }

  /* *
   * return the intersection point of two lines (assuming 
   * infinite projection) or undefined if they are parallel
   * /
  public LineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point|undefined {

    const det = ((a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x));

    if (!det) {
      return undefined; // parallel
    }

    const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / det;

    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };

  }
  */

  public MultiplyPoint(point: Point, scalar: number): Point {
    return {
      x: point.x * scalar,
      y: point.y * scalar,
    };
  }

  public AddPoints(a: Point, b: Point): Point {
    return {
      x: a.x + b.x,
      y: a.y + b.y,
    };
  }

  /**
   * algo from
   * https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline
   */

  public CatmullRomSpline(P: Point[], n: number): Point[] {

    // Parametric constant: 0.5 for the centripetal spline, 
    // 0.0 for the uniform spline, 1.0 for the chordal spline.
    let alpha = .5; 

    // Premultiplied power constant for the following tj() function.
    alpha = alpha/2;
    const tj = (ti: number, Pi: Point, Pj: Point) => {
      const {x: xi, y: yi} = Pi
      const {x: xj, y: yj} = Pj
      return ((xj-xi)**2 + (yj-yi)**2)**alpha + ti;
    };

    const t0 = 0
    const t1 = tj(t0, P[0], P[1]);
    const t2 = tj(t1, P[1], P[2]);
    const t3 = tj(t2, P[2], P[3]);

    const step = (t2-t1) / n;

    const points: Point[] = [];

    for (let i = 0; i < n; i++){ 
      const t = t1 + step * i;
      
      const A1 = this.AddPoints(
        this.MultiplyPoint(P[0], (t1-t)/(t1-t0)),
        this.MultiplyPoint(P[1], (t-t0)/(t1-t0)),
      );

      const A2 = this.AddPoints(
        this.MultiplyPoint(P[1], (t2-t)/(t2-t1)),
        this.MultiplyPoint(P[2], (t-t1)/(t2-t1)),
      );

      const A3 = this.AddPoints(
        this.MultiplyPoint(P[2], (t3-t)/(t3-t2)),
        this.MultiplyPoint(P[3], (t-t2)/(t3-t2)),
      );

      const B1 = this.AddPoints(
        this.MultiplyPoint(A1, (t2-t)/(t2-t0)),
        this.MultiplyPoint(A2, (t-t0)/(t2-t0)),
      );

      const B2 = this.AddPoints(
        this.MultiplyPoint(A2, (t3-t)/(t3-t1)),
        this.MultiplyPoint(A3, (t-t1)/(t3-t1)),
      );

      const C = this.AddPoints(
        this.MultiplyPoint(B1, (t2-t)/(t2-t1)),
        this.MultiplyPoint(B2, (t-t1)/(t2-t1)),
      );

      points.push(C);

    }

    return points;

  }

  /**
   * NOTE: we are munging the point list here, so don't use it after
   * calling this function or pass in a temp copy
   * 
   * OK so that was rude, we will not munge the list
   */
  public CatmullRomChain(original: Point[], n = 30): Point[] {

    const points = original.slice(0);

    const result: Point[] = [];
    const len = points.length;

    if (len) {

      // add two trailing points, extended linearly from existing segmnet

      let dx = points[len-1].x - points[len-2].x;
      let dy = points[len-1].y - points[len-2].y;

      points.push({
        x: points[len-1].x + dx,
        y: points[len-1].y + dy,
      });

      points.push({
        x: points[len-1].x + dx,
        y: points[len-1].y + dy,
      });

      // some for the first point, in the other direction

      dx = points[1].x - points[0].x;
      dy = points[1].y - points[0].y;

      points.unshift({
        x: points[0].x - dx,
        y: points[0].y - dy,
      });

      for (let i = 0; i < points.length - 4; i++) {
        const subset = points.slice(i, i + 4);
        const step = this.CatmullRomSpline(subset, n);
        result.push(...step);
      }

    }

    return result;

  }

  public RenderDataLabels(
      area: Area,
      x: Array<number | undefined>,
      y: Array<number | undefined>,
      x_scale: RangeScale,
      y_scale: RangeScale,
      data_labels: Array<string|undefined>,
      series_index: number ): void {

    // const label_group = SVGNode('g');
    // this.group.appendChild(label_group);

    const count = Math.max(x.length, y.length);
    const xrange = (x_scale.max - x_scale.min) || 1;
    const yrange = (y_scale.max - y_scale.min) || 1;

    for (let i = 0; i < count; i++) {

      const a = x[i];
      const b = y[i];

      if (a !== undefined && b !== undefined) {
        const point ={
          x: area.left + ((a - x_scale.min) / xrange) * area.width,
          y: area.bottom - ((b - y_scale.min) / yrange) * area.height,
        };
        const label = data_labels[i];
        if (label) {

          this.label_group.appendChild(SVGNode('circle', {class: 'label-target', cx: point.x, cy: point.y, r: 10 }));

          const g = SVGNode('g', {class: 'data-label', transform: `translate(${point.x + 10},${point.y})`});
          this.label_group.appendChild(g);

          const circle = SVGNode('circle', {
            cx: -10, y: 0, r: 5, class: `marker-highlight series-${series_index}`
          });
          g.appendChild(circle);

          const text = SVGNode('text', {x: 4, y: 0}, label);
          g.appendChild(text);
          const bounds = text.getBoundingClientRect();
          const h = bounds.height;
          const w = bounds.width + 8;

          if (w + 15 + point.x >= area.right) {
            g.setAttribute('transform', `translate(${point.x - w - 15},${point.y})`)
            circle.setAttribute('cx', (w + 15).toString());
          }

          const rect = SVGNode('path', {d:`M0,5 h${w} v-${h} h-${w} Z`});
          g.insertBefore(rect, text);

        }
      }
    }

  }

  public RenderScatterSeries(area: Area,
    x: Array<number | undefined>,
    y: Array<number | undefined>,
    x_scale: RangeScale,
    y_scale: RangeScale,
    lines = true,
    filled = false,
    markers = false,
    smooth = false,
    classes?: string | string[]): void {

    // ...

    const count = Math.max(x.length, y.length);
    const xrange = (x_scale.max - x_scale.min) || 1;
    const yrange = (y_scale.max - y_scale.min) || 1;

    // const marker_elements: string[] = [];
    const points: Array<Point | undefined> = [];

    const d: string[] = [];
    const areas: string[] = [];

    /*
    const group = document.createElementNS(SVGNS, 'g');
    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      group.setAttribute('class', classes.join(' '));
    }
    */
    const group = SVGNode('g', {class: classes});

    // if (title) node.setAttribute('title', title);
    this.group.appendChild(group);

    for (let i = 0; i < count; i++) {

      const a = x[i];
      const b = y[i];

      if (typeof a === 'undefined' || typeof b === 'undefined') {
        points.push(undefined);
      }
      else {
        points.push({
          x: area.left + ((a - x_scale.min) / xrange) * area.width,
          y: area.bottom - ((b - y_scale.min) / yrange) * area.height,
        });
      }

    }

    // FIXME: merge loops, if possible

    /*
    if (markers) {
      for (const point of points) {
        if (point) {

          // if we can't use CSS to update the path (except in chrome)
          // then it's probably not worth it... leave it for now
          
          // marker_elements.push(`<path d='M0,-1.5 a1.5,1.5,0,1,1,0,3 a1.5,1.5,0,1,1,0,-3' transform='translate(${point.x},${point.y})' class='marker'/>`);

        }
      }
    }
    */

    if (lines) {

        // we need to split into segments in the event of missing data

        let segment: Point[] = [];
        const render_segment = smooth ? () => {

          // segments < 3 should be straight lines (or points)
          if (segment.length === 2) {
            return `${segment[0].x},${segment[0].y} L${segment[1].x},${segment[1].y}`;
          }
          else if (segment.length > 2) {
            const curve = this.CatmullRomChain(segment);
            return curve.map(point => `${point.x},${point.y}`).join(' L');
          }
          return '';

        } : () => {
          return segment.map(point => `${point.x},${point.y}`).join(' L');
        };

        for (const point of points) {
          if (!point) {
            if (segment.length >= 2) {
              const line = render_segment();
              d.push('M' + line);
              areas.push(`M${segment[0].x},${area.bottom}L` + line + `L${segment[segment.length - 1].x},${area.bottom}Z`);
            }
            segment = [];
          }
          else {
            segment.push(point);
          }
        }
 
        if (segment.length >= 2) {
          const line = render_segment();
          d.push('M' + line);
          areas.push(`M${segment[0].x},${area.bottom}L` + line + `L${segment[segment.length - 1].x},${area.bottom}Z`);
        }
      

    }

    if (filled) {
      group.appendChild(SVGNode('path', {d: areas, class: 'fill'}));
    }

    if (lines) {
      group.appendChild(SVGNode('path', {d, class: 'line'}));
    }

    if (markers) {
      for (const point of points) {
        if (point) {
          group.appendChild(SVGNode('circle', {cx: point.x, cy: point.y, r: 3, class: 'marker'}));

          // if we can't use CSS to update the path (except in chrome)
          // then it's probably not worth it... leave it for now
          
          // marker_elements.push(`<path d='M0,-1.5 a1.5,1.5,0,1,1,0,3 a1.5,1.5,0,1,1,0,-3' transform='translate(${point.x},${point.y})' class='marker'/>`);

        }
      }
    }


    // SetSVG(group, `<path d='${d.join(' ')}' class='line' />${marker_elements.join('')}`);

  }


  public RenderPoints(area: Area, x: number[], y: number[], classes?: string | string[]) {

    // const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    for (let i = 0; i < x.length; i++) {
      const px = x[i] * area.width + area.left;
      const py = area.bottom - y[i] * area.height;
      d.push(`M${px - 1},${py - 1} L${px + 1},${py + 1}`);
      d.push(`M${px - 1},${py + 1} L${px + 1},${py - 1}`);
    }

    this.group.appendChild(SVGNode('path', {d, class: classes}));

  }

  public RenderPoint(cx: number, cy: number, classes?: string | string[]): void {
    this.group.appendChild(SVGNode('circle', {cx, cy, r: 1, class: classes}));
  }

  public RenderRectangle(
    area: Area, 
    corner_radius?: number[],
    classes?: string | string[], 
    title?: string, 
    label?: string,
    label_point?: Point): void {

    let d = '';

    if (corner_radius) {

      // two cases we have to worry about: top L/R corner radius > height,
      // and top/bottom L radius > width

      if (corner_radius[0] && 
          corner_radius[0] === corner_radius[1] &&
          corner_radius[0] >= area.height) {

        const c = corner_radius[0];
        const b = corner_radius[0] - area.height;
        const a = Math.sqrt(c * c - b * b);

        d = `M${area.left + area.width / 2 - a},${area.bottom} a${c},${c} 0 0 1 ${a * 2},0 z`;
    
      }
      else if (corner_radius[1] &&
               corner_radius[1] === corner_radius[2] &&
               corner_radius[1] >= area.width) {

        const c = corner_radius[1];
        const b = corner_radius[1] - area.width;
        const a = Math.sqrt(c * c - b * b);
        
        d = `M${area.left},${area.top + area.height / 2 - a} a${c},${c} 0 0 1 0,${a * 2} z`;
        
      }
      else {
        d = `M${area.left},${area.top + corner_radius[0]} ` 
            + `a${corner_radius[0]},${corner_radius[0]} 0 0 1 ${corner_radius[0]},${-corner_radius[0]} `
            + `h${area.width - corner_radius[0] - corner_radius[1]} `
            + `a${corner_radius[1]},${corner_radius[1]} 0 0 1 ${corner_radius[1]},${corner_radius[1]} `
            + `v${area.height - corner_radius[1] - corner_radius[2]} `
            + `a${corner_radius[2]},${corner_radius[2]} 0 0 1 ${-corner_radius[2]},${corner_radius[2]} `
            + `h${-area.width + corner_radius[2] + corner_radius[3]} `
            + `a${corner_radius[3]},${corner_radius[3]} 0 0 1 ${-corner_radius[3]},${-corner_radius[3]} `
            + `v${-area.height + corner_radius[3] + corner_radius[0]} `;
      }
    }
    else {
      /*
      node = SVGNode('rect', {
        x: area.left, 
        y: area.top, 
        width: area.width, 
        height: area.height,
        class: classes });
      */

      d = `M${area.left},${area.top} ` 
        + `h${area.width} `
        + `v${area.height} `
        + `h${-area.width} `
        + `v${-area.height} `;

    }

    const node = SVGNode('path', {
      d, class: classes,
    });

    if (title) {
      node.addEventListener('mouseenter', (event) => {
        this.parent.setAttribute('title', title);
      });
      node.addEventListener('mouseleave', (event) => {
        this.parent.setAttribute('title', '');
      });
    }

    this.group.appendChild(node);

    if (label) {

      this.label_group.appendChild(SVGNode('path', {class: 'label-target', d }));

      const point = label_point || {
        x: Math.round(area.left + area.width / 2),
        y: Math.round(area.top - 10),
      };

      const g = SVGNode('g', {class: 'data-label', transform: `translate(${point.x},${point.y})`});
      this.label_group.appendChild(g);


      const text = SVGNode('text', {x: 0, y: 0}, label);
      g.appendChild(text);
      const bounds = text.getBoundingClientRect();
      const h = bounds.height;
      const w = bounds.width + 8;

      if (point.y - bounds.height < 4) {
        point.y -= (point.y - bounds.height - 4);
        g.setAttribute('transform', `translate(${point.x},${point.y})`);
      }
      
      text.setAttribute('x', Math.floor(-bounds.width/2).toString());

      /*
      if (w + 15 + point.x >= area.right) {
        g.setAttribute('transform', `translate(${point.x - w - 15},${point.y})`)
        // circle.setAttribute('cx', (w + 15).toString());
      }
      */

      const vertical_padding = Math.ceil(h * .125);

      // const rect = SVGNode('path', {d:`M${-w/2},${vertical_padding} h${w} v-${h + vertical_padding / 2} h-${w} Z`});
      const rect = SVGNode('rect', {rx: 3, x: -w/2, y: Math.round(-h + vertical_padding * 2/3), width: w, height: h + vertical_padding});
      g.insertBefore(rect, text);

    }

  }

  /**
   * render text at point
   */
  public RenderText(
      target: SVGElement|undefined, 
      text: string, 
      align: 'center' | 'left' | 'right', 
      point: Point, 
      classes?: string | string[]): void {

    const node = SVGNode('text', {x: point.x, y: point.y, class: classes}, text);

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

    (target||this.group).appendChild(node);

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
    classes?: string | string[]): void {

    let start_angle = -Math.PI / 2; // start at 12:00
    let end_angle = 0;

    if (callouts) {
      outer_radius *= .8;
      inner_radius *= .7;
    }

    const PointOnCircle = (center: Point, radius: number, angle: number) => {
      return [
        Math.cos(angle) * radius + center.x,
        Math.sin(angle) * radius + center.y,
      ];
    };
  
    for (const slice of slices) {

      const title = slice.title || '';

      const value = slice.percent;
      const index = slice.index;

      let d: string[] = [];

      let half_angle = 0;

      const outer = PointOnCircle.bind(0, center, outer_radius);
      const inner = PointOnCircle.bind(0, center, inner_radius);

      if (value > 0.5) {
        // split into two segments

        half_angle = start_angle + (value / 2) * Math.PI * 2;
        end_angle = start_angle + value * Math.PI * 2;

        const delta1 = half_angle - start_angle;
        const delta2 = end_angle - half_angle;

        d.push(
          `M${outer(start_angle)}`,
          `A${outer_radius},${outer_radius},${delta1},0,1,${outer(half_angle)}`,
          `A${outer_radius},${outer_radius},${delta2},0,1,${outer(end_angle)}`,
          `L${inner(end_angle)}`,
          `A${inner_radius},${inner_radius},${delta2},0,0,${inner(half_angle)}`,
          `A${inner_radius},${inner_radius},${delta1},0,0,${inner(start_angle)}`,
          'Z');

      }
      else {

        end_angle = start_angle + value * Math.PI * 2;
        half_angle = (end_angle - start_angle) / 2 + start_angle;

        const delta = end_angle - start_angle;
        d.push(
          `M${outer(start_angle)}`,
          `A${outer_radius},${outer_radius},${delta},0,1,${outer(end_angle)}`,
          `L${inner(end_angle)}`,
          `A${inner_radius},${inner_radius},${delta},0,0,${inner(start_angle)}`,
          'Z');

      }

      const node = SVGNode('path', {
        d, class: (typeof index === 'undefined' ? undefined : `series-${index}`) 
      });

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

      // we're creating a containing group so that we can nth-child the slices,
      // otherwise they'll be in the same group as the title

      const donut = SVGNode('g', {class: classes});

      donut.appendChild(node);
      this.group.appendChild(donut);

      if (/*callouts &&*/ value >= .05 && title) {

        const length = outer_radius - inner_radius;
        d = [];

        const anchor = PointOnCircle(center,
          inner_radius + (outer_radius - inner_radius) / 2 + length, half_angle);

        d.push(`M${PointOnCircle(center, inner_radius + (outer_radius - inner_radius) / 2, half_angle)}`);
        d.push(`L${anchor}`);

        /*
        const callout = document.createElementNS(SVGNS, 'path');
        callout.setAttribute('d', d.join(' '));
        callout.setAttribute('class', 'callout');
        donut.appendChild(callout);
        */
        donut.appendChild(SVGNode('path', { d, class: 'callout' }));

        const text_parts: string[] = [];
        const callout_label = SVGNode('text', {class: 'callout-label'});
        donut.appendChild(callout_label);

        const corrected = half_angle + Math.PI / 2;
        const text = title;

        callout_label.textContent = text;
        let bounds = callout_label.getBoundingClientRect();
        const metrics = {
          width: bounds.width,
          height: bounds.height,
        };

        // const metrics = this.MeasureText(text, ['donut', 'callout-label']);

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
            callout_label.textContent = part;
            bounds = callout_label.getBoundingClientRect();
            const m = {
              width: bounds.width,
              height: bounds.height,
            };
            //const m = this.MeasureText(part, ['donut', 'callout-label']);
            widest = Math.max(widest, m.width);
            return { text: part, metrics: m };
          });

          // console.info('p', parts);

          callout_label.textContent = '';
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
          // already in from measurement 
          // callout_label.textContent = title;
        }

        const text_anchor = corrected > Math.PI ? 'end' : 'start';
        callout_label.setAttribute('text-anchor', text_anchor);
        callout_label.setAttribute('x', x.toString());
        callout_label.setAttribute('y', y.toString());

      }

      start_angle = end_angle;

    }


  }

  /*
  protected PointOnCircle(angle: number, center: Point, radius: number) {
    return [
      Math.cos(angle) * radius + center.x,
      Math.sin(angle) * radius + center.y,
    ];
  }
  */
}
