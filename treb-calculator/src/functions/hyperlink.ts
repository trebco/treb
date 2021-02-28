
import { RenderFunctionOptions, 
         RenderFunctionResult,
         ClickFunctionOptions, 
         ClickFunctionResult, 
         Style, 
         Cell} from 'treb-base-types';

/**
 * hyperlink, based on checkbox (mouse handling). can link to 
 * external resource or within the document.
 * 
 * originally I had planned to use references for local/internal links,
 * but that doesn't work; there's no clear way to disambiguate between 
 * the reference and the contents of the reference as the target. 
 * 
 * =HYPERLINK("google", "https://google.com")
 * =HYPERLINK("reference", "Sheet2!B2")
 * 
 * anything that cannot resolve to either a sheet reference or http/https
 * URI should either return an error in the cell or raise an error when 
 * clicked.
 * 
 * =HYPERLINK("broken", "not a http/https url")
 * 
 */

export const ClickHyperlink = (options: ClickFunctionOptions): ClickFunctionResult => {
  // console.info('click', options);

  const parts = options.cell.renderer_data?.text_data?.strings;

  if (parts && typeof options.x === 'number' && typeof options.y === 'number') {
    for (const part of parts) {
      // validate?
      if (typeof part.left === 'number' 
          && typeof part.top === 'number' 
          && typeof part.width === 'number' 
          && typeof part.height === 'number' ) {

        if (options.x >= part.left 
            && options.y >= part.top
            && options.x <= (part.left + part.width)
            && options.y <= (part.top + part.height)) {
          
          const link = (Array.isArray(options.cell.calculated) && options.cell.calculated[1]) ?
            options.cell.calculated[1] : '';

          return {
            block_selection: true,
            event: {
              type: 'hyperlink',
              data: link,
            }
          }
        }

      }
    }
  }

  return {}; // empty result

};

/** 
 * we use this method to set the flag, not render (hence handled = false) 
 */
export const RenderHyperlink = (options: RenderFunctionOptions): RenderFunctionResult => {

  let override_text: string|undefined;
  let title = 'Click to follow link';

  if (Array.isArray(options.cell.calculated)) {
    override_text = options.cell.calculated[0]?.toString() || '';
    if (options.cell.calculated[1]) {
      title = 'Link: ' + options.cell.calculated[1];
    }
  }

  return { 
    handled: false, // we are not rendering
    metrics: true,  // collect textmetrics data
    title,          // hover
    override_text,  // display
  };

};
