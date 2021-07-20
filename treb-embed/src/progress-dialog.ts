
import {tmpl, NodeModel} from 'treb-utils'; 

/* *
 * colors, which can be controlled by the grid theme
 * /
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
  progress?: string;
  fontSize?: string|number;
  fontFamily?: string;
}
*/

export enum DialogType {
  default = '', 
  info = 'info',
  error = 'error',
  warning = 'warning',
  success = 'success',
  about = 'about',

  initial = 'initial',
}

export interface MessageDialogOptions {
  title?: string;
  message?: string;
  // html?: string;
  icon?: string|boolean;
  close_box?: boolean;
  timeout?: number;
  type?: DialogType;
  // progress?: number;
  // progress_bar?: boolean;
}

export type ResolutionFunction = () => void;

/**
 * rebuilding the dialog, like this:
 * 
 * +======================================================+
 * |        |   TITLE                             |    [X]|
 * | [icon] |   message                           |       |
 * |        |   (progress bar?)                   |       |
 * +------------------------------------------------------+
 * 
 */

/**
 * modal informational dialog that covers the embedded
 * spreadsheet. not fancy.
 */
export class ProgressDialog {

  public static unique_id = Math.random().toString(36).substring(2, 15);

  private model: NodeModel;

  /*
  private mask: HTMLElement;
  private dialog: HTMLElement;

  private title: HTMLElement;
  private message: HTMLElement;

  private left: HTMLElement;
  private right: SVGElement;
  */

  // private progress_container: HTMLElement;
  // private progress_bar: HTMLElement;

  // tslint:disable-next-line:variable-name
  private visible_ = false;

  private timeout: any;

  // private dismiss_on_click = false;

  /*
  private set message(value: string) {
    this.content_node.textContent = value;
    this.content_node.style.display = value ? 'block' : 'none';
  }

  private set title(value: string) {
    this.title_node.textContent = value;
    this.title_node.style.display = value ? 'block' : 'none';
  }
  */

  private pending_dialog_resoltion: ResolutionFunction[] = [];

  private options_: Partial<MessageDialogOptions> = {
    type: DialogType.initial,
  };

  private set options(options: Partial<MessageDialogOptions>) {

    if (options.type === DialogType.about) {
      options.close_box = true;
      options.icon = true;
    }

    if (this.options_.icon !== options.icon) {
      this.model.left.style.display = options.icon ? 'block' : 'none';
    }

    if (this.options_.close_box !== options.close_box) {
      this.model.close.style.display = options.close_box ? 'block' : 'none';
    }

    if (this.options_.message !== options.message) {
      this.model.message.textContent = options.message || '';
      this.model.message.style.display = options.message ? 'block' : 'none';
    }

    if (this.options_.title !== options.title) {
      this.model.title.textContent = options.title || '';
      this.model.title.style.display = options.title ? 'block' : 'none';
    }

    /*
    if (this.options_.progress_bar !== options.progress_bar) {
      this.progress_container.style.display = 
        options.progress_bar ? 'block' : 'none';
    }

    if (this.options_.progress !== options.progress) {
      this.progress_bar.style.width = `${options.progress}%`;
    }
    */

    if (this.options_.type !== options.type) {
      let classes = this.model.dialog.className.replace(/dialog-type-\S+/g, '').trim();
      if (options.type) { classes += ` dialog-type-${options.type}`; }
      this.model.dialog.className = classes;

      if (options.type === 'about') {
        this.model.about.style.display = 'block';
      }
      else {
        this.model.about.style.display = 'none';
      }

    }

    this.options_ = options;


  }

  /*
  private set progress(value: number) {
    this.progress_bar.style.width = `${value}%`;
  }
  */

  private event_handler = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.stopPropagation();
      event.preventDefault();
      this.visible = false;
    }
  }

  private set visible(value: boolean){

    if (value === this.visible_) { return; }
    this.visible_ = value;

    // we want to mask not just the spreadsheet but also the toolbar and 
    // sidebar. unfortunately we built the node structure the other way.
    // not a real problem though, just requires some reacharound

    // actually check that we can do that with CSS -- siblings FTW

    if (value) { 
      // (this.parent_node.firstChild as HTMLElement)?.classList.add('masked');
      this.parent_node.classList.add('masked');

      this.model.mask.classList.add('visible'); 
      window.addEventListener('keydown', this.event_handler);
    }
    else { 
      // (this.parent_node.firstChild as HTMLElement)?.classList.remove('masked');
      this.parent_node.classList.remove('masked');

      this.model.mask.classList.remove('visible'); 
      window.removeEventListener('keydown', this.event_handler);
      const tmp = this.pending_dialog_resoltion.slice(0);
      this.pending_dialog_resoltion = [];
      Promise.resolve().then(() => {
        for (const func of tmp) {
          func();
        }
      });
    }

  }

  private get visible(){
    return this.visible_;
  }

  constructor(private parent_node: HTMLElement) { // }, options: MaskDialogOptions = {}) {

    // const color = '#8CC63F';
    const color = '#036ec1';

    // check if we have attached our gradient
    const gradient_id = 'treb-leaf-gradient-' + ProgressDialog.unique_id;
    let test = document.querySelector('#' + gradient_id);
    if (!test) {
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
      svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.style.width = '0';
      svg.style.height = '0';
      svg.style.overflow = 'hidden';

      const linear = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      linear.setAttribute('id', gradient_id);
      linear.setAttribute('gradientUnits', 'userSpaceOnUse');
      linear.setAttribute('x1', '0.6729');
      linear.setAttribute('y1', '32');
      linear.setAttribute('x2', '63.3271');
      linear.setAttribute('y2', '32');

      let stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', '0');
      stop.style.stopColor = '#D4D400';
      linear.appendChild(stop);

      stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', '1');
      stop.style.stopColor = '#AD4500';
      linear.appendChild(stop);

      svg.appendChild(linear);
      document.body.appendChild(svg);

    }

    this.model = tmpl`
      <div id='mask' class='treb-embed-mask'>
        <div id='dialog' class='treb-embed-dialog'>
          <div id='left'>
            <a href='https://treb.app' target='_blank'>
              <svg width=48 height=48 viewBox='0 0 64 64'>
                ${ /*
                <path fill="${color}" d="M37.913,14.323c-2.042,0-7.067,2.558-8.72,3.481c-0.959-1.012-1.065-2.522-1.243-4.475 c-0.959,0.994-0.337,4.014,0,5.115c-4.19,3.125-7.707,6.357-11.295,10.016c-1.225-1.936-2.06-3.517-2.344-7.033 c-1.243,2.664,0.355,6.163,1.278,8.098c-3.96,4.99-7.885,10.354-11.064,15.486C-10.001,14.323,34.344-3.916,63.327,8.641 c-17.955,11.952-22.59,49.672-54.13,39.639c-2.22,3.197-3.712,7.37-5.541,11.082c-1.527,0.107-2.593-0.675-2.983-1.278    c3.072-7.441,7.033-13.995,11.082-20.459c4.387,0.125,8.737,0.195,12.36-0.426c-3.144-0.834-6.908-0.319-10.655-1.278    c2.291-4.387,5.63-7.726,8.95-11.082c3.605,0.32,7.264,1.314,11.082,0.426c-3.32-0.586-6.535-0.799-9.377-1.705 C27.223,20.131,33.438,16.401,37.913,14.323z"/>

                <linearGradient id="gradient" gradientUnits="userSpaceOnUse" x1="0.6729" y1="32" x2="63.3271" y2="32">
                <stop  offset="0" style="stop-color:#D4D400"/>
                <stop  offset="1" style="stop-color:#AD4500"/>
              </linearGradient>

                */ '' }


              <path fill="URL(#${gradient_id})" d="M37.913,14.323c-2.042,0-7.067,2.558-8.72,3.481c-0.959-1.012-1.065-2.522-1.243-4.475
                c-0.959,0.994-0.337,4.014,0,5.115c-4.19,3.125-7.707,6.357-11.295,10.016c-1.225-1.936-2.06-3.517-2.344-7.033
                c-1.243,2.664,0.355,6.163,1.278,8.098c-3.96,4.991-7.885,10.354-11.064,15.486C-10.001,14.323,34.344-3.916,63.327,8.641
                C45.372,20.593,40.736,58.313,9.197,48.28c-2.22,3.196-3.712,7.37-5.541,11.081c-1.527,0.107-2.593-0.674-2.983-1.277
                c3.072-7.441,7.033-13.995,11.082-20.459c4.387,0.125,8.737,0.195,12.36-0.426c-3.144-0.834-6.908-0.319-10.655-1.278
                c2.291-4.387,5.63-7.726,8.95-11.082c3.605,0.32,7.264,1.314,11.082,0.426c-3.32-0.586-6.535-0.799-9.377-1.705
                C27.223,20.131,33.438,16.401,37.913,14.323z"/>

              </svg>
            </a>
          </div>
          <div id='middle'>
            <div id='title' class='treb-embed-dialog-title'></div>
            <div id='message' class='treb-embed-dialog-message'></div>
            <div id='about' class='treb-embed-dialog-body'>
              TREB version ${process.env.BUILD_VERSION}<div class='smaller'><a target=_blank href='https://treb.app'>http://treb.app</a></div>
            </div>
          </div>
          <div id='close' class='close-box'>
            <svg viewBox='0 0 16 16'>
              <path d='M11.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708l7-7a.5.5 0 0 1 .708 0z'/>
              <path d='M4.146 4.146a.5.5 0 0 0 0 .708l7 7a.5.5 0 0 0 .708-.708l-7-7a.5.5 0 0 0-.708 0z'/>
            </svg>
          </div>
        </div>
      </div>
    `;

    // patch gradient -- we could reuse, though

    /*
    const node = this.model.mask.querySelector('path');
    if (node && this.model.gradient.id) {
      node.setAttribute('fill', `URL(#${this.model.gradient.id})`);
    }
    */

    this.model.close.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.HideDialog();
    });
  
    parent_node.appendChild(this.model.mask);

    // this.dialog.textContent = ' ';
    // this.UpdateTheme(options);

  }

  private Div(class_name?: string, parent?: HTMLElement): HTMLDivElement {
    const div = document.createElement('div');
    if (class_name) { div.setAttribute('class', class_name); }
    if (parent) { parent.appendChild(div); }
    return div;
  }

  /*
  public UpdateTheme(options: MaskDialogOptions): void {

    if (options.mask) {
      this.model.mask.style.backgroundColor = options.mask;
    }
    if (options.background) {
      this.model.dialog.style.backgroundColor = options.background;
    }
    if (options.text) {
      this.model.dialog.style.color = options.text;
    }
    if (options.fontFamily) {
      this.model.dialog.style.fontFamily = options.fontFamily;
    }
    if (options.fontSize) {
      let font_size = options.fontSize || null;
      if (typeof font_size === 'number') {
        font_size = `${font_size}pt`;
      }
      this.model.dialog.style.fontSize = font_size || '';
    }

    // if (options.border) {
    //  this.dialog.style.borderColor = options.border;
    // }

    / *
    if (options.progress) {
      this.progress_bar.style.backgroundColor = options.progress;
    }
    * /

  }
  */

  public Update(options: Partial<MessageDialogOptions>, delta = true): void {

    if (delta) {
      options = { ...this.options_, ... options};
    }
    this.options = options;

  }

  /*
  public Update(message?: string, progress?: number): void {
    if (typeof message !== 'undefined'){
      this.options = {
        message,
        title: '',
        type: DialogType.default
      }
      // this.message = message;
    }
    if (typeof progress !== 'undefined') {
      this.progress = progress;
    }
  }
  */

  public HideDialog(): void {
    this.visible = false;
  }

  public ShowDialog(options: Partial<MessageDialogOptions>): Promise<void> {

    return new Promise((resolve) => {

      this.pending_dialog_resoltion.push(resolve);

      /*
      this.message = options.message || '';
      this.title = options.title || '';
      */
      this.options = options;


      // this.progress_container.style.display = 'none';

      this.visible = true;
      
      if (this.timeout) { 
        clearTimeout(this.timeout); 
        this.timeout = 0;
      }
      
      if (options.timeout) {
        this.timeout = setTimeout(() => this.HideDialog(), options.timeout);
      }

    });

  }

  /*
  public ShowProgressDialog(message?: string, progress?: number) { // }, dismiss_on_click = false) {
    if (typeof message !== 'undefined'){
      // this.message = message;
      this.options = { title: '', message, type: DialogType.default };
    }
    if (typeof progress !== 'undefined') {
      this.progress = progress;
    }
    this.progress_container.style.display = 'block';
    // this.dismiss_on_click = dismiss_on_click;
    this.visible = true;
  }
  */

}
