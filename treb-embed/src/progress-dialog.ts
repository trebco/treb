
import {tmpl, NodeModel} from 'treb-utils'; 

/**
 * colors, which can be controlled by the grid theme
 */
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
  progress?: string;
  fontSize?: string|number;
  fontFamily?: string;
}

export enum DialogType {
  default = 0, 
  info,
  error,
  warning,
  success,
}

export interface MessageDialogOptions {
  title?: string;
  message?: string;
  icon?: string;
  close_box?: boolean;
  timeout?: number;
  type?: DialogType;
  // progress?: number;
  // progress_bar?: boolean;
}

/**
 * rebuilding the dialog, like this:
 * 
 * +======================================================+
 * |        |   TITLE                             |       |
 * | [icon] |   message                           |  [X]  |
 * |        |   (progress bar?)                   |       |
 * +------------------------------------------------------+
 * 
 */

/**
 * modal informational dialog that covers the embedded
 * spreadsheet. not fancy.
 */
export class ProgressDialog {

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

  private options_: Partial<MessageDialogOptions> = {};

  private set options(options: Partial<MessageDialogOptions>) {
  
    if (this.options_.icon !== options.icon) {
      this.model.left.style.display = options.icon ? 'block' : 'none';
    }

    if (this.options_.close_box !== options.close_box) {
      this.model.right.style.display = options.close_box ? 'block' : 'none';
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

      this.model.dialog.classList.remove('dialog-type-error', 'dialog-type-warning', 'dialog-type-success', 'dialog-type-info');
      switch (options.type) {
        case DialogType.info:
          this.model.dialog.classList.add('dialog-type-info');
          break;
        case DialogType.success:
          this.model.dialog.classList.add('dialog-type-success');
          break;
        case DialogType.error:
          this.model.dialog.classList.add('dialog-type-error');
          break;
        case DialogType.warning:
          this.model.dialog.classList.add('dialog-type-warning');
          break;
      }

    }

    this.options_ = options;


  }

  /*
  private set progress(value: number) {
    this.progress_bar.style.width = `${value}%`;
  }
  */

  private set visible(value: boolean){

    if (value === this.visible_) { return; }
    this.visible_ = value;

    if (value) { this.model.mask.classList.add('visible'); }
    else { this.model.mask.classList.remove('visible'); }

  }

  private get visible(){
    return this.visible_;
  }

  constructor(private parent_node: HTMLElement, options: MaskDialogOptions = {}) {

    this.model = tmpl`
      <div id='mask' class='treb-embed-mask'>
        <div id='dialog' class='treb-embed-dialog'>
          <div id='left'></div>
          <div id='middle'>
            <div id='title' class='treb-embed-dialog-title'></div>
            <div id='message' class='treb-embed-dialog-message'></div>
          </div>
          <div id='right'>
            <svg viewBox='0 0 16 16'>
              <path d='M11.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708l7-7a.5.5 0 0 1 .708 0z'/>
              <path d='M4.146 4.146a.5.5 0 0 0 0 .708l7 7a.5.5 0 0 0 .708-.708l-7-7a.5.5 0 0 0-.708 0z'/>
            </svg>
          </div>
        </div>
      </div>
    `;

    this.model.right.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.HideDialog();
    });
  
    parent_node.appendChild(this.model.mask);

    // this.dialog.textContent = ' ';
    this.UpdateTheme(options);

  }

  private Div(class_name?: string, parent?: HTMLElement): HTMLDivElement {
    const div = document.createElement('div');
    if (class_name) { div.setAttribute('class', class_name); }
    if (parent) { parent.appendChild(div); }
    return div;
  }

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

    /*
    if (options.progress) {
      this.progress_bar.style.backgroundColor = options.progress;
    }
    */

  }

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

  public ShowDialog(options: Partial<MessageDialogOptions>): void {


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
