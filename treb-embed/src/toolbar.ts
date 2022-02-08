
import { tmpl, composite, NodeModel } from 'treb-utils';
// import { icons } from './generated/toolbar42';
// import { symbol_defs } from './generated/symbol-defs';
import { Style, Localization, Area, Theme, Color } from 'treb-base-types';
import { EventSource } from 'treb-utils';
import { NumberFormatCache } from 'treb-format';
import { Measurement } from 'treb-utils';
import { EmbeddedSpreadsheetOptions } from './options';
import { GridSelection } from 'treb-grid';
import { ThemeColor2 } from 'treb-base-types';

import '../style/toolbar-4.scss';

/**
 * state that should be reflected in toolbar buttons/selections
 */
export interface SelectionState {
  style?: Style.Properties;
  merge?: boolean;
  frozen?: boolean;
  comment?: string;
  selection?: GridSelection;
}

export interface ToolbarCancelEvent {
  type: 'cancel';
}

export interface ToolbarClickEvent {
  type: 'button';
  command: string;
  data?: any;
}

export interface ToolbarFontSizeEvent {
  type: 'font-size';
  style: Style.Properties;
}

export interface ToolbarNumberFormatEvent {
  type: 'format';
  format: string;
}

export type ToolbarEvent = ToolbarClickEvent 
  | ToolbarCancelEvent
  | ToolbarFontSizeEvent
  | ToolbarNumberFormatEvent;

/**
 * I've gone back and forth on toolbar so many times... we're back
 * to a static, constant (and very simple) toolbar although I will
 * abstract interfaces so we can swap out more easily in the future.
 */
export class Toolbar extends EventSource<ToolbarEvent> {

  public model: NodeModel;

  public number_formats: string[] = [];
  public date_formats: string[] = [];
  public colors: string[] = [];
  public color_target?: string;

  public state?: SelectionState;

  /** the current color, if you click the button (not the dropdown) */
  public background_color?: Style.Color = { text: 'yellow' };

  /** the current color, if you click the button (not the dropdown) */
  public foreground_color?: Style.Color = { text: 'blue' };

  /** the current color, if you click the button (not the dropdown) */
  public border_color?: Style.Color = undefined; // { theme: 0 };

  // public theme_color_map: string[] = [];

  private outer_container?: HTMLElement;

  private menu_map: Record<string, HTMLElement> = {};
  private menu_index = 1;

  constructor(public container: HTMLElement, public options: EmbeddedSpreadsheetOptions, public theme: Theme) {

    super();

    this.outer_container = container.parentElement as HTMLElement;

    const ds = Localization.decimal_separator;

    for (const value of [0, 128, 192, 212, 256]) {
      this.colors.push(`rgb(${value}, ${value}, ${value})`);
    }
    for (const color of ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet']){ 
      this.colors.push(color);
    }

    // 
    // NOTE regarding dropdowns: you can't nest a button (interactive element)
    // inside a button. that's why the dropdown menus have to be siblings of,
    // and cannot be children of, the dropdown buttons.
    // 

    this.model = tmpl`
      <div id='root' class='treb-toolbar'>

        <div class='group narrow'>
          <button id='text-align' data-command='align-left' title='Align left'><icon>bootstrap/text-left</icon></button>

          <button class='drop'></button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button id='align-left-drop' data-command='align-left' title='Align left', data-replace='text-align'><icon>bootstrap/text-left</icon></button></li>
              <li><button id='align-center-drop' data-command='align-center' title='Align center', data-replace='text-align'><icon>bootstrap/text-center</icon></button></li>
              <li><button id='align-right-drop' data-command='align-right' title='Align right', data-replace='text-align'><icon>bootstrap/text-right</icon></button></li>
            </ul>
          </div>
        </div>

        <div class='group narrow'>
          <button id='vertical-align' data-command='align-top' title='Align top'><icon>FA/light/arrow-up-to-line</icon></button>

          <button class='drop'></button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button id='align-top-drop' data-command='align-top' title='Align top', data-replace='vertical-align'><icon>FA/light/arrow-up-to-line</icon></button></li>
              <li><button id='align-middle-drop' data-command='align-middle' title='Align middle', data-replace='vertical-align'><icon>FA/light/arrows-to-line</icon></button></li>
              <li><button id='align-bottom-drop' data-command='align-bottom' title='Align bottom', data-replace='vertical-align'><icon>FA/light/arrow-down-to-line</icon></button></li>
            </ul>
          </div>
        </div>

        ${options.file_menu ? `
        <div class='group wide'>
          <button title='File options' class='drop-button'><icon>FA/light/save</icon></button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button class='text' data-command='reset'>New Document</button></li>
              <hr/>
              <li><button class='text' data-command='import-desktop'>Open File</button></li>
              <li><button class='text' data-command='save-json'>Save JSON</button></li>
              <hr/>
              <li><button class='text' data-command='export-xlsx'>Export XLSX</button></li>
            </ul>
          </div>
        </div>
        ` : ''}

        <div class='group wide'>
          <button id='align-left' title='Align left' data-command='align-left'><icon>bootstrap/text-left</icon></button>
          <button id='align-center' title='Align center' data-command='align-center'><icon>bootstrap/text-center</icon></button>
          <button id='align-right' title='Align right' data-command='align-right'><icon>bootstrap/text-right</icon></button>
        </div>

        <div class='group wide'>
          <button id='align-top' data-command='align-top' title='Align top'><icon>FA/light/arrow-up-to-line</icon></button>
          <button id='align-middle' data-command='align-middle' title='Align middle'><icon>FA/light/arrows-to-line</icon></button>
          <button id='align-bottom' data-command='align-bottom' title='Align bottom'><icon>FA/light/arrow-down-to-line</icon></button>
        </div>

        <div class='group'>

          <button id='wrap' data-command='wrap' title='Wrap text'>
            <icon>extra/wrap</icon>
          </button>

          <button id='merge' data-command='merge' title='Merge cells'>
            <icon class='zam active-icon'>FA/light/expand</icon>
            <icon class='zam inactive-icon'>FA/light/compress</icon>
          </button>
          
          <button id='lock' data-command='lock'><icon>FA/light/lock-keyhole</icon></button>

          <button id='comment' class='drop-button' title='Comment'>
            <icon>FA/light/message</icon>
          </button>

          <div class='drop-menu' tabindex='-1'>
            <div class='comment-editor'>
              <div class='label' id='comment-label'></div>
              <textarea id='comment-text' class='comment-textarea'></textarea>
              <div class='comment-buttons'>
                <button data-command='clear-comment'>Clear</button>
                <button id='update-comment' data-command='update-comment'>Save</button>
              </div>
            </div>
          </div>
        </div>

        <div class='group'>
          <button class='color-button' data-command='background-color' title='Background color'>
            <icon>FA/light/fill-drip</icon>
            <div id='background-color-bar' class='color-bar' ></div>
          </button>
          <button class='drop'></button>
          <div class='drop-menu color-chooser' data-target='background' tabindex='-1'></div>
        </div>

        <div class='group'>
          <button class='color-button' data-command='foreground-color' title='Text color'>
            <icon>FA/light/font</icon>
            <div id='foreground-color-bar' class='color-bar' ></div>
          </button>
          <button class='drop'></button>
          <div class='drop-menu color-chooser' data-target='foreground' tabindex='-1'></div>
        </div>

        ${options.font_scale ? `
        <div class='group wide'>
          <div class='container font-size'>
            <input value='' id='font-size-input' title='Font scale'>
          </div>
          <button class='drop'>
          </button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button class='text' data-command='font-scale' data-scale='0.80'>0${ds}80</button></li>
              <li><button class='text' data-command='font-scale' data-scale='0.90'>0${ds}90</button></li>
              <li><button class='text' data-command='font-scale' data-scale='1.00'>1${ds}00</button></li>
              <li><button class='text' data-command='font-scale' data-scale='1.10'>1${ds}10</button></li>
              <li><button class='text' data-command='font-scale' data-scale='1.20'>1${ds}20</button></li>
              <li><button class='text' data-command='font-scale' data-scale='1.50'>1${ds}50</button></li>
              <li><button class='text' data-command='font-scale' data-scale='2.00'>2${ds}00</button></li>
            </ul>
          </div>
        </div>
        ` : ''}

        <div class='group'>
          <button id='update-border' data-command='border-bottom' title='Bottom border'><icon>FA/light/border-bottom</icon></button>

          <button class='drop'>
          </button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li>
                <button id='border-top' data-command='border-top' title='Top border' data-replace='update-border'>
                  <icon>FA/light/border-top</icon>
                </button>
              </li>        
              <li>
                <button id='border-left' data-command='border-left' title='Left border' data-replace='update-border'>
                  <icon>FA/light/border-left</icon>
                </button>
              </li>        
              <li>
                <button id='border-right' data-command='border-right' title='Right border' data-replace='update-border'>
                  <icon>FA/light/border-right</icon>
                </button>
              </li>        
              <li>
                <button id='border-bottom' data-command='border-bottom' title='Bottom border' data-replace='update-border'>
                  <icon>FA/light/border-bottom</icon>
                </button>
              </li>        

              <li>
                <button id='border-double-bottom' data-command='border-double-bottom' title='Double bottom border' data-replace='update-border'>
                  <icon>extra/border-double-bottom2</icon>
                </button>
              </li>        

              <li>
                <button id='border-all' data-command='border-all' title='All borders' data-replace='update-border'>
                  <icon>FA/light/border-all</icon>
                </button>
              </li>        
              <li>
                <button id='border-outside' data-command='border-outside' title='Outside borders' data-replace='update-border'>
                  <icon>FA/light/border-outer</icon>
                </button>
              </li>        
              <li>
                <button id='border-none' data-command='border-none' title='Remove borders' data-replace='update-border'>
                  <icon>FA/light/border-none</icon>
                </button>
              </li>        

              <hr/>

              <li>
                <button id='border-color' class='color-button drop-button' data-position='horizontal' title='Border color'>
                  <icon>FA/light/palette</icon>
                  <div id='border-color-bar' class='color-bar'></div>
                </button>

                <div class='drop-menu color-chooser' data-target='border' tabindex='-1'></div>
              </li>
            </ul>
          </div>
        </div>

        <!-- merge was here -->
        
        <div class='group'>
          <button id='layout' class='drop-button' title='Rows/columns'>
            <icon>FA/light/ruler-triangle</icon>
          </button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button class='text' data-command='insert-row'>Insert row</button></li>
              <li><button class='text' data-command='insert-column'>Insert column</button></li>
              <li><button class='text' data-command='delete-row'>Delete row</button></li>
              <li><button class='text' data-command='delete-column'>Delete column</button></li>
            </ul>
            ${options.add_tab ?
            `<ul>
              <hr/>
              <li><button class='text' data-command='insert-sheet'>Insert sheet</button></li>
              <li><button class='text' data-command='delete-sheet'>Delete sheet</button></li>
            </ul>` : ''
            }
          </div>
        </div>

        <div class='group'>
          <button id='freeze' data-command='freeze'><icon>FA/light/snowflake</icon></button>
        </div>

        <div class='group'>
          <div class='container'>
            <input value='General' id='number-format-input' title='Number format'>
          </div>
          <button class='drop'></button>
          <div class='drop-menu scroll' tabindex='-1' data-number-formats></div>
        </div>

        <div class='split-button'>
          <button data-command='decrease-decimal' title='Decrease precision'>
            <div>0${ds}0</div>
          </button>
          <button data-command='increase-decimal' title='Increase precision'>
            <div>0${ds}00</div>
          </button>
        </div>

        <div class='group'>

          <button id='insert-annotation' data-command='column-chart' title='Insert column chart'>
            <icon class='symbol'>extra/column-chart</icon>
          </button>

          <button class='drop'></button>
          <div class='drop-menu' tabindex='-1'>
            <ul>
              <li><button title='Insert column chart' id='column-chart' data-command='column-chart' data-replace='insert-annotation'><icon class='symbol'>extra/column-chart</icon></button></li>
              <li><button title='Insert donut chart' id='donut-chart' data-command='donut-chart' data-replace='insert-annotation'><icon class='symbol'>extra/donut-chart</icon></button></li>
              <li><button title='Insert bar chart' id='bar-chart' data-command='bar-chart' data-replace='insert-annotation'><icon class='symbol'>extra/bar-chart</icon></button></li>
              <li><button title='Insert line chart' id='line-chart' data-command='line-chart' data-replace='insert-annotation'><icon class='symbol'>extra/line-chart</icon></button></li>
              <hr/>
              <li>
                <button id='insert-image' data-command='insert-image' title='Insert image' data-replace='insert-annotation'>
                  <icon>FA/light/image</icon>
                </button>
              </li>
            </ul>
          </div>
        </div>

        ${ options.toolbar_recalculate_button ? `
            <div class='group end-group'>
              <button data-command='recalculate' title='Recalculate'>
                <icon>FA/light/arrows-rotate</icon>
              </button>
            </div>
        ` : ``
        }

        <div class='staging'>
          <div id='color-chooser' class='color-chooser-main'>
            <div class='color-header'>Theme colors</div>
            <div id='theme-color-list' class='color-list'></div>

            <div class='color-header other-colors'>Other colors</div>
            <div id='color-list' class='color-list'></div>
            
            <div class='new-color'>
              <input id='color-input' placeholder='New Color'>
              <button id='color-button'>
                <icon>FA/light/check</icon>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    // fix for removed background colors

    this.model['background-color-bar'].style.color = 'yellow';
    this.model['foreground-color-bar'].style.color = 'blue';
    this.model['border-color-bar'].style.color = '#333';

    // handle colors

    const color_button = this.model['color-button'] as HTMLElement;
    const color_input = this.model['color-input'] as HTMLInputElement;

    this.UpdateTheme(theme);
    // this.RenderThemeColors(this.model['theme-color-list'] as HTMLElement);

    color_button.addEventListener('click', () => {
      this.CommitColor({text: color_input.value || ''});
    });

    color_input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.CommitColor({text: color_input.value || ''});
      }
    });
    color_input.addEventListener('input', () => {
      color_button.style.backgroundColor = '';
      const value = color_input.value || '';
      // requestAnimationFrame(() => color_button.style.backgroundColor = value);
      color_button.style.backgroundColor = value;

      const color = Measurement.MeasureColor(value);
      const hsl = Color.RGBToHSL(color[0], color[1], color[2]); // can't destructure? 

      color_button.style.color = (hsl.l > .5) ? '' : '#fff';
      
    });

    (this.model['comment-text'] as HTMLTextAreaElement).addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.stopPropagation();
        event.preventDefault();
        (this.model['update-comment'] as HTMLElement).click(); 
        return;
      }
    });

    let cached_size = '';
    const size_input = this.model['font-size-input'] as HTMLInputElement;
    
    // this is gated on an option, so it may not exist
    
    if (size_input) {
      size_input.addEventListener('focus', () => cached_size = size_input.value || '');
      size_input.addEventListener('keydown', (event: KeyboardEvent) => {
        switch (event.key) {
          case 'Enter':
            if (size_input.value) {

              let text = size_input.value;

              // lock this down to reasonable values only?
              if (Localization.decimal_separator !== '.') {
                text = text.replace(new RegExp(Localization.decimal_separator, 'g'), '.');
              }
              this.Publish({ type: 'font-size', style: Style.ParseFontSize(text)});

            }
            else {
              this.Publish({ type: 'font-size', style: {
                // font_size_unit: undefined,
                // font_size_value: undefined,
                font_size: undefined,
              }});
            }
            break;

          case 'Escape':
            format_input.value = cached_format;
            this.Publish({ type: 'cancel' });
            break;

          default:
            return;
        }
        event.stopPropagation();
        event.preventDefault();
      });
    }

    let cached_format = '';
    const format_input = this.model['number-format-input'] as HTMLInputElement;
    format_input.addEventListener('focus', () => cached_format = format_input.value || '');
    format_input.addEventListener('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
          this.Publish({ type: 'format', format: format_input.value || ''});
          break;

        case 'Escape':
          format_input.value = cached_format;
          this.Publish({ type: 'cancel' });
          break;

        default:
          return;
      }
      event.stopPropagation();
      event.preventDefault();
    });

    this.model.root.addEventListener('click', (event) => {
      this.HandleClick(event);
    });

    if (/narrow/i.test((options.toolbar || '').toString())) {
      this.model.root.classList.add('narrow');
    }

    // console.info(this.model);
    container.appendChild(this.model.root);

  }

  public HandleClick(event: MouseEvent): void {

    const color_button = this.model['color-button'] as HTMLElement;
    const color_input = this.model['color-input'] as HTMLInputElement;

    const element = (event.target as HTMLElement);
    let command = element?.dataset?.command;

    if (command) {
      const data: any = {};

      if (/^border-/.test(command)) {
        data.border = command;
        data.color = this.border_color; // || '';
        command  = 'border';
      }
      else {
        switch (command) {
          case 'font-scale':
            data.scale = element?.dataset?.scale || 1;
            break;

          case 'clear-comment':
          case 'update-comment':
            if (this.state?.selection && !this.state.selection.empty) {
              data.address = {...this.state.selection.target};
            }
            data.comment = (this.model['comment-text'] as HTMLTextAreaElement).value || '';
            break;

          case 'background-color':
            data.target = 'background';
            data.color = this.background_color;
            break;

          case 'foreground-color':
            data.target = 'foreground';
            data.color = this.foreground_color;
            break;

          case 'border-color':
            data.target = 'border';
            data.color = this.border_color;
            break;

        }
      }
      this.Publish({
        type: 'button', 
        command,
        data,
      });
      return;
    }

    if(element?.classList?.contains('drop') || element?.classList?.contains('drop-button')) {

      // we're jumping through all sorts of hoops here to manage the "horizontal"
      // drop menu, which is for border color. the other menus get attached to
      // the outer container, but that one can stay where it is because its
      // parent has already moved.
      
      let parent = element.parentElement;

      while (parent && !parent.classList.contains('group')) {
        if (parent === this.model.root) {
          return;
        }
        parent = parent.parentElement;
      }
      if (parent || element.dataset.position === 'horizontal') {

        let focus_target: HTMLElement|undefined;
        let sibling: HTMLElement|undefined;

        if (element.dataset.menu_target) {
          sibling = this.menu_map[element.dataset.menu_target];
        }
        else {
          sibling = element.nextSibling as HTMLElement;
          const index = (this.menu_index++).toString();
          this.menu_map[index] = sibling;
          element.dataset.menu_target = index;
          sibling.style.position = 'absolute';
          sibling.classList.add('treb-toolbar-drop-menu');

          if (element.dataset.position !== 'horizontal') {
            this.outer_container?.appendChild(sibling);
          }
        }

        // const sibling = (element as any).sibling || element.nextSibling as HTMLElement;

        if (sibling?.classList?.contains('drop-menu')) {

          if (element === this.model.comment) {
            this.model['comment-label'].textContent = 
              this.state?.selection?.target ?
                Area.CellAddressToLabel(this.state?.selection.target) : '';
            (this.model['comment-text'] as HTMLTextAreaElement).value = this.state?.comment || '';
            focus_target = this.model['comment-text'];
          }

          if (sibling.dataset.numberFormats !== undefined) {
            this.RenderNumberFormats(sibling);
          }
          
          if (sibling.classList.contains('color-chooser')) {
            this.color_target = sibling.dataset?.target || '';
            this.RenderColors(this.model['color-list']);

            // reset color
            color_input.value = '';
            color_button.style.backgroundColor = '';
            color_button.style.color = '';
            sibling.appendChild(this.model['color-chooser'])
          }

          // NEW STRATEGY: we're going back to absolute positioning, but
          // shifting the popup to the container (outside of the toolbar).
          // 
          // the idea is that then it can still pop out of the toolbar 
          // container, but it will scroll with the document. if we use
          // fixed positioning, everything works EXCEPT for when the document
          // resizes or scrolls.

          // of course this breaks the styling, because that's nested...

          if (element.dataset?.position === 'horizontal') {

            this.Focus(sibling, element.offsetWidth + 12, element.offsetTop - 8, focus_target);
            // this.Focus(sibling, 0, 0, focus_target);
            
          }
          else {

            const bounding_rect = ((element.classList.contains('drop-button')) ? element : parent)?.getBoundingClientRect() || {x: 0};
            const outer_bounds = this.outer_container?.getBoundingClientRect() || {x: 0, right: 0};

            let left = bounding_rect.x - outer_bounds.x;

            const width = sibling.offsetWidth;
            if (width > 0 && left + width > outer_bounds.right) {
              left = Math.max(0, outer_bounds.right - width - 10); // buffer
            }

            this.Focus(sibling, left, element.offsetHeight + 4, focus_target);
          }

          /*

          // we're switching to fixed position for the popups, so they can
          // break out of a scroll box (and we're scrolling the toolbar, at
          // least on mobile).

          // that requires we get the fixed position of the container before
          // we show the popup. because it disappears on focusout, generally
          // scrolling shouldn't be an issue

          // actually parent isn't necessarily what we want -- that's only
          // for the split buttons. for the other ones we want the element
          // itself (the button).

          const bounding = (element.classList.contains('drop-button')) ? element : parent;
          const bounding_rect = bounding.getBoundingClientRect() || {x: 0, y: 0, bottom: 0};

          // NOTE: the horizontal thing is used for border color only (atm).
          // but, in that case we don't necessarily want to position relative
          // to the parent? why not? (because it's broken, that's why)

          // FIXME: since we're positioning, we can fix overflows if we are
          // overflowing to the right (TODO/FIXME)

          if (element.dataset?.position === 'horizontal') {
            this.Focus(sibling, element.offsetWidth + 12 + bounding_rect.x, element.offsetTop - 8 + bounding_rect.y, focus_target);
          }
          else {

            let left = bounding_rect.x;

            // not sure this is always available? maybe client-specific?
            // let's only do it opportunistically

            if (sibling.offsetWidth > 0) {
              const containing_rect = this.container.parentElement?.getBoundingClientRect();
              if (containing_rect) {
                if (left + sibling.offsetWidth > containing_rect.right) {
                  left = Math.max(0, containing_rect.right - sibling.offsetWidth);
                }
              }
            }

            this.Focus(sibling, left, bounding_rect.bottom + 4, focus_target);
          }

          */

        }
      }
      return;
    }

    // console.info(event.target);

  }

  public ResolveColor(color: Style.Color|undefined, default_color: Style.Color): string {

    // if (!color) {
    //  color = default_color;
    // }

    return ThemeColor2(this.theme, color || default_color) || '';

    /*
    if (color.text) {
      return color.text;
    }

    if (typeof color.theme === 'number') {


      if (this.theme.theme_colors) {
        return this.theme.theme_colors[color.theme] || '';
      }
      return '';

      // return this.theme.theme_colors
      // return this.theme_color_map[color.theme] || '';

    }

    return '';
    */

  }

  public CommitColor(color?: Style.Color): void {

      switch (this.color_target) {

        case 'background':
          this.model['background-color-bar'].style.color = this.ResolveColor(color, {theme: 0});
          this.background_color = color ? { ...color } : undefined;
          break;

        case 'border':
          this.model['border-color-bar'].style.color = this.ResolveColor(color, {theme: 1});
          this.border_color = color ? { ...color } : undefined;
          break;

        case 'foreground':
          if (!color) {
            color = { theme: 1 };
          }
          this.model['foreground-color-bar'].style.color = this.ResolveColor(color, {theme: 1});
          this.foreground_color = color ? { ...color } : undefined;
          break;

      }

      this.Publish({ 
          type: 'button', 
          command: 'color', 
          data: {
            color: color ? { ...color } : undefined,
            target: this.color_target || '',
          }
        });
  }

  /**
   * focus a popup.
   * 
   * @param element - position target
   * @param left - position
   * @param top - position
   * @param focus_target - alternate focus target, if we want to focus a child 
   * instead of the element itself. this is used for the comment popup, where
   * we want to focus on the text area.
   */
  public Focus(element: HTMLElement, left: number, top: number, focus_target?: HTMLElement): void {

    element.style.left = left + 'px';
    element.style.top = top + 'px';

    element.classList.add('enabled');
    requestAnimationFrame(() => element.classList.add('visible'));

    // handle escape key (closes popup)
    const esc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        this.Publish({ type: 'cancel' });
      }
    };
    window.addEventListener('keydown', esc);

    // handle click event -- see if we want to pass to parent or not
    const click = (event: MouseEvent) => {

      const target = (event.target as HTMLElement);
      if (target.dataset?.replace) {
        const replace_target = this.model[target.dataset.replace];
        replace_target.innerHTML = target.innerHTML;
        replace_target.setAttribute('title', target.getAttribute('title') || '');
        replace_target.dataset.command = target.dataset.command || undefined;
      }

      if (target.dataset?.command === 'number-format') {
        const format = target.textContent || 'General';
        (this.model['number-format-input'] as HTMLInputElement).value = target.textContent || '';
        this.Publish({ type: 'format', format });
      }
      else if (target.dataset?.command || target.classList?.contains('drop-button')) {
        this.HandleClick(event);
        return;
      }
      else if (target.classList?.contains('color-swatch')) {

        if (typeof target?.dataset?.theme !== 'undefined') {
          let index = Number(target?.dataset?.theme);
          if (isNaN(index)) { index = 0; }

          const props: Style.Color = { theme: index || 0 };
          if (target?.dataset?.tint) {
            const tint = Number(target.dataset.tint);
            if (tint && !isNaN(tint)) {
              props.tint = tint;
            }
          }
          this.CommitColor(props);

        }
        else {
          const color = target?.dataset?.color || '';
          this.CommitColor(color ? {text: color} : undefined);
        }
      }

      // console.info(target);

      event.stopPropagation();
    };
    element.addEventListener('click', click);

    const transitionend = () => {
      if (!element.classList.contains('visible')) {
        element.style.left = '';
        element.style.top = '';
      }
      element.removeEventListener('transitionend', transitionend);
    }

    // on focus out of the parent, close and clean up
    const focusout = (event: FocusEvent) => {

      const related = event.relatedTarget as HTMLElement;
      if (related && element.contains(related)) {
        return;
      }
      element.classList.remove('visible');
      element.removeEventListener('focusout', focusout);
      element.removeEventListener('click', click);
      window.removeEventListener('keydown', esc);

      // unposition
      element.addEventListener('transitionend', transitionend);

    };
    element.addEventListener('focusout', focusout);

    // allow the class to update
    requestAnimationFrame(() => (focus_target||element).focus());

  }

  public UpdateState(state: SelectionState): void {

    this.state = state;

    const map = {
      'align-center': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Center,
      'align-left': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Left,
      'align-right': state.style && state.style?.horizontal_align === Style.HorizontalAlign.Right,

      'align-top': state.style && state.style?.vertical_align === Style.VerticalAlign.Top,
      'align-middle': state.style && state.style?.vertical_align === Style.VerticalAlign.Middle,
      'align-bottom': state.style && state.style?.vertical_align === Style.VerticalAlign.Bottom,

      'wrap': state.style && !!state.style.wrap,
      'comment': !!state.comment,
    };

    // new narrow dropdowns
    // ...
    

    // this.comment = state.comment || '';

    const freeze = this.model.freeze;
    if (state.frozen) {
      freeze.classList.add('active');
      freeze.setAttribute('title', 'Unfreeze panes');
    }
    else {
      freeze.classList.remove('active');
      freeze.setAttribute('title', 'Freeze panes');
    }

    if (state.style?.locked) {
      this.model.lock.classList.add('active');
      this.model.lock.setAttribute('title', 'Unlock cells');
    } 
    else {
      this.model.lock.classList.remove('active');
      this.model.lock.setAttribute('title', 'Lock cells');
    }

    const merge = this.model.merge;
    if (state.merge) {
      merge.classList.add('active');
      merge.dataset.command = 'unmerge';
      merge.setAttribute('title', 'Unmerge cells');
    }
    else {
      merge.classList.remove('active');
      merge.dataset.command = 'merge';
      merge.setAttribute('title', 'Merge cells');
    }
    
    // this is gated on an option, so it may not exist
    const font_size = this.model['font-size-input'] as HTMLInputElement;
    if (font_size) {
      let text = Style.RelativeFontSize(state.style || {}, this.theme.grid_cell || {}).toFixed(2);
      text = text.replace(/\./g, Localization.decimal_separator);
      font_size.value = text;
    }
    
    const format = state.style?.number_format || '';
    (this.model['number-format-input'] as HTMLInputElement).value = 
      NumberFormatCache.SymbolicName(format) || format;

    Object.keys(map).forEach(key => {
      if ((map as any)[key]) {
        this.model[key]?.classList.add('active');
      }
      else {
        this.model[key]?.classList.remove('active');
      }
    });

  }

  public UpdateTheme(theme: Theme): void {
    const target = this.model['theme-color-list'] as HTMLElement;
    const html: string[] = []; // [`<div class='row'>`];

    const labels = [
      'Background',
      'Text',
      'Background',
      'Text',
      'Accent',
      'Accent',
      'Accent',
      'Accent',
      'Accent',
      'Accent',
    ]

    let i = 0;

    if (theme.theme_colors) {

      // UPDATE: one or the other, don't need both

      if (this.options.tint_theme_colors) {

        // html.push('<hr/>');
        for (const tint of [.5, .25, 0, -.25, -.5]) {

          html.push(`<div class='color-list-row'>`);
          for (i = 0; i < 10; i++) {
            let color = theme.theme_colors[i] || '#000';
            if (tint) {
              const scale = Math.round(Math.abs(tint) * 100);
              const direction = tint > 0 ? 'lighter' : 'darker';
              color += ` (${scale}% ${direction})`
            }
            const bg = this.ResolveColor({ theme: i, tint }, {});
            html.push(`<button data-color='${bg}' class='color-swatch' data-tint=${tint} data-theme=${i} title='${labels[i]}: ${color}' ></button>`);
          }
          html.push(`</div>`);
    
        }

      }
      else {
        html.push(`<div class='color-list-row'>`);
        for (i = 0; i < 10; i++) {
          const color = theme.theme_colors[i] || '#000';
          // html.push(`<button style='background-color: ${color}' class='color-swatch' data-theme=${i} title='${labels[i]}: ${color}' ></button>`);
          html.push(`<button data-color='${color}' class='color-swatch' data-theme=${i} title='${labels[i]}: ${color}' ></button>`);
        }
        html.push(`</div>`);
  
      }

    }

    target.innerHTML = html.join('');

    const buttons = target.querySelectorAll('button[data-color]') as NodeListOf<HTMLButtonElement>;
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].style.backgroundColor = buttons[i].dataset.color || '';
    }

  }

  public RenderColors(target: HTMLElement): void {

    const html: string[] = [
      `<div class='color-list-row'>`,
      `<button class='color-swatch default-color' data-color='' title='Default color'></button>`];

    let i = 0;
    for ( ; i < 9 && i < this.colors.length; i++) {
      const color = this.colors[i];
      // html.push(`<button class='color-swatch' data-color='${color}' title='${color}' style='background-color: ${color}'></button>`)
      html.push(`<button class='color-swatch' data-color='${color}' title='${color}' ></button>`)
    }
    html.push('</div>');

    while (i < this.colors.length) {
      html.push(`<div class='color-list-row'>`);
      const end = i + 10;
      for ( ; i < this.colors.length && i < end; i++) {
        const color = this.colors[i];
        // html.push(`<button class='color-swatch' data-color='${color}' title='${color}' style='background-color: ${color};'></button>`)
        html.push(`<button class='color-swatch' data-color='${color}' title='${color}' ></button>`)
      }
      html.push('</div>');
    }

    target.innerHTML = html.join('');

    const buttons = target.querySelectorAll('button.color-swatch');
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i] as HTMLButtonElement;
      button.style.background = button.dataset.color || '';
    }

  }

  public RenderNumberFormats(target: HTMLElement): void {
    target.innerHTML = composite`
      <ul>
        ${this.number_formats.map(format => composite`
          <li><button data-command='number-format' class='text'>${format}</button></li>
        `).join('\n')}
      </ul>
      <hr/>
      <ul>
        ${this.date_formats.map(format => composite`
          <li><button data-command='number-format' class='text'>${format}</button></li>
        `).join('\n')}
      </ul>
    `;
  }

  public UpdateDocumentStyles(formats: string[], colors: string[], update: boolean): void {
   
    const number_formats: string[] = [
        'General', 'Number', 'Integer', 'Percent', 'Fraction', 'Accounting', 'Currency', 'Scientific',
    ];

    const date_formats: string[] = [
      'Timestamp', 'Long Date', 'Short Date',
    ];

    for (const format of formats) {
      if (NumberFormatCache.SymbolicName(NumberFormatCache.Translate(format))) { continue; }
      const instance = NumberFormatCache.Get(format);
      if (instance.date_format) {
        date_formats.push(format);
      }
      else {
        number_formats.push(format);
      }
    }

    this.number_formats = number_formats;
    this.date_formats = date_formats;

    // FIXME: cache measured colors

    const compare = this.colors.map(color => Measurement.MeasureColor(color));
    for (const color of colors) {

      // FIXME: sanitize input

      const rgb = Measurement.MeasureColor(color);
      if (!compare.some(test => (test[0] === rgb[0]) && (test[1] === rgb[1]) && (test[2] === rgb[2]))) {
        // console.info('adding', color)
        this.colors.push(color);
        compare.push(rgb);
      }
    }
  
  }

  /*
  public IconButtons(info: Array<{icon: string, id?: string}>) {
    return info.map(data => this.IconButton(data.icon, data.id)).join('');
  }
  * /

  public DropButton(icon: string, id?: string, command: string|boolean = true, title?: string): string {
    return `
      <div class='group'>
        ${this.IconButton(icon, id, command, title)}
        <button class='drop'></button>
    </div>
    `;
  }
  */

  /*
  public IconButton(icon: string, id?: string, command: string|boolean = true, title?: string, replace?: string): string {
    if (id && command === true) { 
      command = id;
    }
    return `<button${id ? ` id='${id}'` : ''}` +
           `${replace ? ` data-replace='${replace}'` : ''}` +
           `${command ? ` data-command='${command}'` : ''}${title ? ` title='${title}'` : ''}>${this.Icon(icon)}</button>`
  }

  public Icon(icon: string, classes = ''): string {
    let model = icons[icon];
    let base = '';
    let baseclass = '';

    if (!model) {
      model = symbol_defs[icon];
      base = `symbol`;
    }

    if (classes || base) {
      baseclass = ` class='${base} ${classes}'`
    }

    if(!model) {
      console.warn(icon);
      return ``;
    }

    return `<svg${baseclass} viewBox='${model.viewbox || '0 0 24 24'}'>${(model.paths||[]).map(path => {
      let classes = ' ';
      if (Array.isArray(path.classes)) {
        classes += path.classes.join(' ');
      }
      else if (path.classes) {
        classes += path.classes;
      }
      return `<path d='${path.d}' class='${classes.trim()}'/>`;
    }).join('')}</svg>`;

  }
  */
  
}
