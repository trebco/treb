
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

/**
 * FIXME: normalize API, make canvas version
 */
export class ChartRenderer {

  public parent!: HTMLElement;
  public svg_node!: SVGElement;
  public group!: SVGGElement;
  public text_measurement_node?: SVGTextElement;

  public axis_group?: SVGElement;

  public size: Size = { width: 0, height: 0 };
  public bounds: Area = new Area();

  // public smoothing_factor = 0.2;

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

  public Legend(options: LegendOptions) {
    const group = document.createElementNS(SVGNS, 'g');
    this.group.appendChild(group);

    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'text');
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

    let y = max_height;

    const entries: string[] = [];
    // const nodes: SVGElement[] = [];


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

        const trident_offset = trident ? `dy='.3em'` : '';

        entries.push(`<text dominant-baseline="middle" ${trident_offset} x='${x + marker_width}' y='${y}'>${label}</text>`);

        if (options.style === LegendStyle.marker) {
          entries.push(`<rect class='series-${index + 1}' x='${x}' y='${marker_y - 4}' width='8' height='8' />`)
        }
        else {
          entries.push(`<rect class='series-${index + 1}' x='${x}' y='${marker_y - 1}' width='${marker_width - 3}' height='2'/>`)
        }

        h = Math.max(h, text_metrrics.height);
        x += text_metrrics.width + marker_width + padding;

      }

      y = Math.round(y + h * 1.1);
    }

    SetSVG(group, entries.join(''));

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

    return legend_size;

  }

  public Clear() {
    this.axis_group = undefined;
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

    const text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('class', 'chart-title');
    text.textContent = title;
    text.style.textAnchor = 'middle';
    text.setAttribute('x', Math.round(area.width / 2).toString());

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

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    const step = area.width / (count);
    for (let i = 0; i < count; i++) {
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

  public GetAxisNode() {
    if (!this.axis_group) { 
      this.axis_group = document.createElementNS(SVGNS, 'g');
      this.axis_group.setAttribute('class', 'axis-group');
      this.group.appendChild(this.axis_group);
    }
    return this.axis_group; 
  }

  /** specialization for bar; it's different enough that we want special treatment */
  public RenderXAxisBar(
    area: Area,
    offset: boolean,
    labels: string[],
    metrics: Metrics[],
    classes?: string | string[]) {

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

    const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const x = Math.round(area.left + initial_offset + step * i);
      // if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(axis, labels[i], 'center', { x, y: area.bottom }, classes);
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
    classes?: string | string[]) {

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

    const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const x = Math.round(area.left + initial_offset + step * i);
      // if (x + metrics[i].width / 2 >= area.right) { break; }
      this.RenderText(axis, labels[i], 'center', { x, y: area.bottom }, classes);
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

    const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const label = labels[i];
      const y = Math.round(area.bottom - step * (i + .5) + label.metrics.height / 4);
      this.RenderText(axis, label.label, 'right', { x: left, y }, classes);
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

    const axis = this.GetAxisNode();

    for (let i = 0; i < count; i += increment) {
      const label = labels[i];
      const y = Math.round(area.bottom - step * i + label.metrics.height / 4);
      this.RenderText(axis, label.label, 'right', { x: left, y }, classes);
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

    let move = true;
    let last_x: number | undefined;

    let last_point: Point | undefined;

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

    {
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
      }
      circle_group.setAttribute('class', 'mouse-layer');
      this.group.appendChild(circle_group);

    }

  }

  /**
   * the other RenderGrid function has semantics specifically for area/line.
   * rather than try to shoehorn this in we'll use a different method.
   */
  public RenderBarGrid(area: Area, x_count: number, classes?: string | string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    const step = area.width / (x_count);
    for (let i = 0; i <= x_count; i++) {
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

  public RenderGrid(area: Area, y_count: number, x_count = 0, classes?: string | string[]) {

    const node = document.createElementNS(SVGNS, 'path');
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
   * return the intersection point of two lines (assuming 
   * infinite projection) or undefined if they are parallel
   */
  public LineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point|undefined {

    const det = ((a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x));

    if (!det) {
      return undefined; // parallel
    }

    const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / det;

    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };

  }

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
   */
  public CatmullRomChain(points: Point[], n = 30): Point[] {

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

  public RenderScatterSeries(area: Area,
    x: Array<number | undefined>,
    y: Array<number | undefined>,
    x_scale: RangeScale,
    y_scale: RangeScale,
    lines = true,
    markers = false,
    smooth = false,
    classes?: string | string[]): void {

    // ...

    const count = Math.max(x.length, y.length);
    const xrange = (x_scale.max - x_scale.min) || 1;
    const yrange = (y_scale.max - y_scale.min) || 1;

    const marker_elements: string[] = [];
    const points: Array<Point | undefined> = [];

    const d: string[] = [];

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

    if (markers) {
      for (const point of points) {
        if (point) {

          // if we can't use CSS to update the path (except in chrome)
          // then it's probably not worth it... leave it for now
          
          marker_elements.push(`<path d='M0,-1.5 a1.5,1.5,0,1,1,0,3 a1.5,1.5,0,1,1,0,-3' transform='translate(${point.x},${point.y})' class='marker'/>`);

        }
      }
    }

    if (lines) {

      if (smooth) {

        // we need to split into segments in the event of missing data

        let segment: Point[] = [];
        const render_segment = () => {

          // segments < 3 should be straight lines (or points)
          if (segment.length === 2) {
            d.push(`M${segment[0].x},${segment[0].y} L${segment[1].x},${segment[1].y}`);
          }
          else if (segment.length > 2) {
            const curve = this.CatmullRomChain(segment);
            d.push('M' + curve.map(point => `${point.x},${point.y}`).join(' L'));
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

        /*

        // trailing point
        let last_point: Point | undefined;

        // trailing line for curve angle
        let last_line: { a: Point, b: Point } | undefined;

        for (let i = 0; i < points.length; i++) {

          const point = points[i];

          // leading point
          let next_point = points[i + 1];

          if (point) {
            // const [a, b] = point;
            let drawn = false;

            if (last_point) {

              const line1 = {
                a: last_point, // { x: last_point[0], y: last_point[1] },
                b: point, // { x: point[0], y: point[1] },
              };
              const p1 = this.LineProperties(line1.a, line1.b);

              if (!next_point && last_line) {

                const px1 = this.LineProperties(last_line.a, last_line.b);
                const angle = p1.angle;
                const split = (angle * 3 - px1.angle) / 2;

                next_point = {
                  x: point.x + Math.cos(split) * 25,
                  y: point.y + Math.sin(split) * 25,
                };

              }

              if (next_point) {

                const line2 = {
                  a: point, // { x: point[0], y: point[1] },
                  b: next_point, // { x: next_point[0], y: next_point[1] },
                };

                const p2 = this.LineProperties(line2.a, line2.b);

                const angle = (p1.angle + p2.angle) / 2;

                const a1 = Math.cos(angle) * 10 + point.x;
                const b1 = Math.sin(angle) * 10 + point.y;

                const this_line = { a: point, b: { x: a1, y: b1 } };
                const this_props = this.LineProperties(this_line.a, this_line.b);

                if (!last_line) {

                  // p1 is the angle of _this_ segment
                  // this line is the new half-angle

                  const split = (p1.angle * 3 - angle) / 2;
                  const px = {
                    x: last_point.x + 20 * Math.cos(split),
                    y: last_point.y + 20 * Math.sin(split),
                  }

                  last_line = {
                    a: last_point, b: px,
                  };

                  // d2.push(`M${last_point[0]},${last_point[1]} L${px.x},${px.y}`);

                }

                if (last_line) {

                  const last_props = this.LineProperties(last_line.a, last_line.b);

                  if ((last_props.angle >= p1.angle && p1.angle >= this_props.angle)
                    || (last_props.angle <= p1.angle && p1.angle <= this_props.angle)) {

                    const q = this.LineIntersection(last_line.a, last_line.b, this_line.a, this_line.b);
                    if (q) {
                      d.push(`M${last_point.x},${last_point.y} Q${q.x},${q.y} ${point.x},${point.y}`);
                      drawn = true;
                    }
                  }
                  else {

                    const midpoint = {
                      x: point.x + (last_point.x - point.x) / 2,
                      y: point.y + (last_point.y - point.y) / 2,
                    };

                    const angle_1 = p1.angle; // that's the line 
                    const angle_2 = this_props.angle; // that's the PRIOR split

                    // this bit is maybe broken, not sure: 

                    const AA = (angle_1 + angle_2) / 2;
                    const DX = angle_1 - AA;
                    let BB = angle_1 + 2 * DX;

                    // BB = (p1.angle * 3 - this_props.angle)/2;
                    const zed = 12;

                    const midline = {
                      a: { ...midpoint },
                      b: { x: midpoint.x + Math.cos(BB) * -zed, y: midpoint.y + Math.sin(BB) * -zed },
                    };

                    // d2.push(`M${midpoint.x + Math.cos(BB) * -zed},${midpoint.y + Math.sin(BB) * -zed}`);
                    // d2.push(`L${midpoint.x + Math.cos(BB) * zed},${midpoint.y + Math.sin(BB) * zed}`);

                    // drawn = true;

                    const q1 = this.LineIntersection(last_line.a, last_line.b, midline.a, midline.b);
                    const q2 = this.LineIntersection(this_line.a, this_line.b, midline.a, midline.b);

                    if (q1 && q2) {
                      d.push(`M${last_point.x},${last_point.y} Q${q1.x},${q1.y} ${midpoint.x},${midpoint.y}`);
                      d.push(`Q${q2.x},${q2.y} ${point.x},${point.y}`);
                      drawn = true;
                    }

                  }

                }

                // const a2 = Math.cos(angle) * -10 + a;
                // const b2 = Math.sin(angle) * -10 + b;

                // d2.push(`M${a1},${b1} L${a2},${b2}`)

                last_line = this_line;

              }
            }

            if (!drawn) {
              d.push(`${last_point ? 'L' : 'M'}${point.x},${point.y}`);
            }

          }

          last_point = point;

        }

        */

      }
      else {
        let last_point = undefined;
        for (const point of points) {
          if (point) {
            d.push(`${last_point ? 'L' : 'M'}${point.x},${point.y}`);
          }
          last_point = point;
        }
      }

    }

    const group = document.createElementNS(SVGNS, 'g');
    SetSVG(group, `<path d='${d.join(' ')}' class='line' />${marker_elements.join('')}`);

    if (typeof classes !== 'undefined') {
      if (typeof classes === 'string') {
        classes = [classes];
      }
      group.setAttribute('class', classes.join(' '));
    }

    // if (title) node.setAttribute('title', title);
    this.group.appendChild(group);

  }


  public RenderPoints(area: Area, x: number[], y: number[], classes?: string | string[]) {

    const node = document.createElementNS(SVGNS, 'path');
    const d: string[] = [];

    for (let i = 0; i < x.length; i++) {
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

  public RenderPoint(x: number, y: number, classes?: string | string[]) {

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

  public RenderRectangle(area: Area, classes?: string | string[], title?: string) {

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
  public RenderText(
      target: SVGElement|undefined, 
      text: string, 
      align: 'center' | 'left' | 'right', 
      point: Point, 
      classes?: string | string[]) {

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
    classes?: string | string[]) {

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
        node.setAttribute('class', `series-${index}`);
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

      if (typeof classes !== 'undefined') {
        if (typeof classes === 'string') {
          classes = [classes];
        }
        donut.setAttribute('class', classes.join(' '));
      }
      this.group.appendChild(donut);

      if (/*callouts &&*/ value >= .05 && title) {

        const callout = document.createElementNS(SVGNS, 'path');
        const length = outer_radius - inner_radius;
        d = [];

        const anchor = this.PointOnCircle(half_angle, center,
          inner_radius + (outer_radius - inner_radius) / 2 + length);

        d.push(`M${this.PointOnCircle(half_angle, center, inner_radius + (outer_radius - inner_radius) / 2)}`);
        d.push(`L${anchor}`);
        callout.setAttribute('d', d.join(' '));
        callout.setAttribute('class', 'callout');
        donut.appendChild(callout);

        const text_parts: string[] = [];
        const callout_label = document.createElementNS(SVGNS, 'text');
        callout_label.setAttribute('class', 'callout-label');
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

          console.info('p', parts);

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

  protected PointOnCircle(angle: number, center: Point, radius: number) {
    return [
      Math.cos(angle) * radius + center.x,
      Math.sin(angle) * radius + center.y,
    ];
  }

}
