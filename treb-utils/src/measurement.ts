
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

  public static EnsureMeasurementNode(){

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

  }

  /**
   * check if font is loaded, based on the theory that the alternatives
   * will be different sizes. note that this probably doesn't test weights
   * or italics properly, as those can be emulated without the specific face.
   *
   * I guess the thing to do in that case would be to load the alternate faces
   * first, and assume they are loaded serially (they're not).
   *
   * @param font_face
   * @param italic
   * @param bold
   */
  public static FontLoaded(font_face: string, italic = false, weight = 400) {
    const face = `${italic ? 'italic' : ''} ${weight} 20pt ${font_face}`;
    const m1 = this.MeasureText(`${face}, sans-serif`, `check font`);
    const m2 = this.MeasureText(`${face}, serif`, `check font`);
    const m3 = this.MeasureText(`${face}, monospace`, `check font`);
    return (m1.width === m2.width && m2.width === m3.width);
  }

  /**
   * measure width, height of text, accounting for rotation
   */
  public static MeasureText(font: string, text: string, angle = 0): Metrics {

    this.EnsureMeasurementNode();
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
      height: rect.height,
    };
    
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

