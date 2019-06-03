
/** size, really */
export interface Metrics {
  width: number;
  height: number;
}

export class Measurement {

  public static MeasureColorARGB(color: string){
    const bytes = this.MeasureColor(color);
    let argb = 'FF'; // always 100%
    for (let i = 0; i < 3; i++) {
      const hex = bytes[i].toString(16);
      if (hex.length === 0) argb += '00';
      else if (hex.length === 1) argb += `0${hex}`;
      else argb += hex;
    }
    return argb.toUpperCase();
  }

  /**
   * measure a color. turns symbolic or rgb colors into rgb values.
   */
  public static MeasureColor(color: string){

    let cached = this.color_cache[color];
    if (cached) {
      return cached;
    }

    if (!this.color_measurement_canvas) {
      this.color_measurement_canvas = document.createElement('canvas');
      this.color_measurement_canvas.width = 1;
      this.color_measurement_canvas.height = 1;
    }

    const context = this.color_measurement_canvas.getContext('2d');
    if (context) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      cached = context.getImageData(0, 0, 1, 1).data;
      this.color_cache[color] = cached;
      return cached;
    }

    return new Uint8ClampedArray(3);

  }

  /**
   * measure width, height of text, accounting for rotation
   */
  public static MeasureText(font: string, text: string, angle = 0){

    if (!this.text_measurement_node) {
      const node = document.querySelector('.treb-chart-measurement-node');
      if (node) {
        this.text_measurement_node = node as HTMLElement;
      }
      else {
        this.text_measurement_node = document.createElement('div');
        this.text_measurement_node.classList.add('treb-chart-measurement-node');
        this.text_measurement_node.style.margin = '0px';
        this.text_measurement_node.style.padding = '0px';
        this.text_measurement_node.style.whiteSpace = 'nowrap';
        this.text_measurement_node.style.position = 'fixed';
        this.text_measurement_node.style.border = '0px';
        this.text_measurement_node.style.border = '1px solid red';
        this.text_measurement_node.style.boxSizing = 'content-box';
        this.text_measurement_node.style.top =
          this.text_measurement_node.style.left = '-1000px';
        document.body.appendChild(this.text_measurement_node);
      }
    }
    this.text_measurement_node.style.font = font;
    if (/\n/.test(text)) {
      text = text.replace(/\n/g, '<BR/>');
      this.text_measurement_node.innerHTML = text;
    }
    else {
      this.text_measurement_node.textContent = text;
    }
    this.text_measurement_node.style.lineHeight = '1em';
    if (angle) {
      this.text_measurement_node.style.transform = `rotate(${angle}deg)`;
    }
    else this.text_measurement_node.style.transform = '';

    const rect = this.text_measurement_node.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height } as Metrics;

  }

  /** canvas used for color measurement */
  private static color_measurement_canvas: HTMLCanvasElement;

  /**
   * node used for text metrics. this has to be added to
   * the DOM, so it's fixed and shifted off screen.
   */
  private static text_measurement_node: HTMLElement;

  /** cache for color lookups */
  private static color_cache: {[index: string]: Uint8ClampedArray} = {};

}
