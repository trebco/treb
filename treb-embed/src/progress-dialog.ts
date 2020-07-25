
/**
 * colors, which can be controlled by the grid theme
 */
export interface MaskDialogOptions {
  background?: string;
  border?: string;
  text?: string;
  mask?: string;
  progress?: string;
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

  private mask: HTMLElement;
  private dialog: HTMLElement;

  private title: HTMLElement;
  private message: HTMLElement;

  private left: HTMLElement;
  private right: SVGElement;

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
      this.left.style.display = options.icon ? 'block' : 'none';
    }

    if (this.options_.close_box !== options.close_box) {
      this.right.style.display = options.close_box ? 'block' : 'none';
    }

    if (this.options_.message !== options.message) {
      this.message.textContent = options.message || '';
      this.message.style.display = options.message ? 'block' : 'none';
    }

    if (this.options_.title !== options.title) {
      this.title.textContent = options.title || '';
      this.title.style.display = options.title ? 'block' : 'none';
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

      this.dialog.classList.remove('dialog-type-error', 'dialog-type-warning', 'dialog-type-success', 'dialog-type-info');
      switch (options.type) {
        case DialogType.info:
          this.dialog.classList.add('dialog-type-info');
          break;
        case DialogType.success:
          this.dialog.classList.add('dialog-type-success');
          break;
        case DialogType.error:
          this.dialog.classList.add('dialog-type-error');
          break;
        case DialogType.warning:
          this.dialog.classList.add('dialog-type-warning');
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

    if (value) { this.mask.classList.add('visible'); }
    else { this.mask.classList.remove('visible'); }

  }

  private get visible(){
    return this.visible_;
  }

  constructor(private parent_node: HTMLElement, options: MaskDialogOptions = {}) {

    this.mask = this.Div('treb-embed-mask', parent_node);
    this.dialog = this.Div('treb-embed-dialog', this.mask);

    /*
    this.dialog.addEventListener('click', () => {
      if (this.dismiss_on_click) { this.HideDialog(); }
    });
    */

    this.left = this.Div(undefined, this.dialog);
    const middle = this.Div(undefined, this.dialog);
    // this.right = this.Div(undefined, this.dialog);

    const svgns = 'http://www.w3.org/2000/svg';
    this.right = document.createElementNS(svgns, 'svg')
    this.right.setAttribute('viewBox', '0 0 16 16');
    this.dialog.appendChild(this.right);

    let path = document.createElementNS(svgns, 'path');
    path.setAttribute('d', 'M11.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708l7-7a.5.5 0 0 1 .708 0z');
    this.right.appendChild(path);

    path = document.createElementNS(svgns, 'path');
    path.setAttribute('d', 'M4.146 4.146a.5.5 0 0 0 0 .708l7 7a.5.5 0 0 0 .708-.708l-7-7a.5.5 0 0 0-.708 0z');
    this.right.appendChild(path);
                           /*
    <svg width="1em" height="1em" viewBox="0 0 16 16" class="bi bi-x" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" d="M11.854 4.146a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708-.708l7-7a.5.5 0 0 1 .708 0z"></path>
  <path fill-rule="evenodd" d="M4.146 4.146a.5.5 0 0 0 0 .708l7 7a.5.5 0 0 0 .708-.708l-7-7a.5.5 0 0 0-.708 0z"></path>
</svg>
    */

   this.right.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.HideDialog();
    });
    
    this.title = this.Div('treb-embed-dialog-title', middle);
    this.message = this.Div('treb-embed-dialog-message', middle);

    // this.progress_container = this.Div('treb-embed-progress-container', middle);
    // this.progress_bar = this.Div('treb-embed-progress-bar', this.progress_container);
    // this.progress_container.style.display = 'none';


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
      this.mask.style.backgroundColor = options.mask;
    }
    if (options.background) {
      this.dialog.style.backgroundColor = options.background;
    }
    if (options.text) {
      this.dialog.style.color = options.text;
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
