/*! API v25.0.0-rc3. Copyright 2018-2023 trebco, llc. All rights reserved. LGPL: https://treb.app/license */

/**
 * add our tag to the map
 */
declare global {
  interface HTMLElementTagNameMap {
    'treb-spreadsheet': HTMLElement & {
      sheet: EmbeddedSpreadsheet|undefined;
    };
  }
}
/**
 * API class for creating spreadsheets. this is intended as a singleton,
 * we will export an instance of the class.
 */
export declare class TREBGlobal {

    /**
     * build version
     */
    version: string;

    /**
     * create a spreadsheet instance
     */
    CreateSpreadsheet(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet;
}

/** single instance of factory class */
export declare const TREB: TREBGlobal;

/**
 * options for creating spreadsheet
 */
export interface EmbeddedSpreadsheetOptions {

    /** containing HTML element */
    container?: string | HTMLElement;

    /** allow drag-and-drop files */
    dnd?: boolean;

    /**
     * expandable grid. if this option is false, the grid will always
     * stay the same size -- if you keep pressing down arrow, it won't
     * grow. defaults to true.
     */
    expand?: boolean;

    /**
     * key in localStorage for persisting document.
     *
     * it's possible to set this to boolean `true`, in which case we will
     * generate a storage key based on the page URI.
     *
     * that can be convenient for quickly setting up a document, but don't
     * use it if the page URI might change (the storage will get lost)
     * or if there are multiple spreadsheets on the same page (they will
     * overwrite each other).
     */
    storage_key?: string | boolean;

    /** don't load immediately (?) */
    toll_initial_load?: boolean;

    /** show formula bar. default true. */
    formula_bar?: boolean;

    /** expand formula bar */
    expand_formula_button?: boolean;

    /** scroll to cell on load */
    scroll?: string | ICellAddress;

    /** sheet to show on load, overrides anything in the model */
    sheet?: string;

    /** add resizable wrapper */
    resizable?: boolean;

    /** export to xlsx, now optional */
    export?: boolean;

    /**
     * fetch network document. this is a replacement for the old
     * (deprecated) option `network_document`.
     */
    document?: string;

    /**
     * fetch network document (URI)
     * @deprecated - use `document`
     */
    network_document?: string;

    /** freeze rows */
    freeze_rows?: number;

    /** freeze columns */
    freeze_columns?: number;

    /** row/column headers */
    headers?: boolean;

    /** recalculate on load */
    recalculate?: boolean;

    /** show scrollbars */
    scrollbars?: boolean;

    /** show tab bar (multi sheet) */
    tab_bar?: boolean | 'auto';

    /** allow add tab */
    add_tab?: boolean;

    /** show delete tab */
    delete_tab?: boolean;

    /** set a reference in global (self) */
    global_name?: string;

    /** support undo */
    undo?: boolean;

    /** support in-cell editor */
    in_cell_editor?: boolean;

    /** prompt "you have unsaved changes" */
    prompt_save?: boolean;

    /**
     * toolbar display option. true or false means include/don't include
     * the toolbar (and the toolbar button). setting to "narrow" means
     * include the toolbar, but use a narrow version (it compresses the
     * align/justify groups).
     *
     * the toolbar usually starts hidden. if you set this option to "show",
     * it will start visible. same for "show-narrow".
     */
    toolbar?: boolean | 'show' | 'narrow' | 'show-narrow';

    /** include the file menu in the toolbar */
    file_menu?: boolean;

    /** include the font scale control in the toolbar */
    font_scale?: boolean;

    /** include the insert/remove table button in the toolbar */
    table_button?: boolean;

    /** include the freeze button in the toolbar */
    freeze_button?: boolean;

    /** include the chart menu in the toolbar */
    chart_menu?: boolean;

    /** include a recalculate button in the toolbar */
    toolbar_recalculate_button?: boolean;

    /** better support for headless operations (default false) */
    headless?: boolean;

    /** max size for image, in bytes */
    max_file_size?: number;

    /** initial scale */
    scale?: number;

    /**
     * show scale control (slider) under the spreadsheet.
     */
    scale_control?: boolean;

    /**
     * show the stats panel under the spreadsheet.
     */
    stats?: boolean;

    /**
     * save/load scale. this can optionally have a string key to disambiguate
     */
    persist_scale?: boolean | string;

    /**
     * target window for hyperlinks (default _blank); set false to disable hyperlinks altogether
     */
    hyperlinks?: string | false;

    /**
     * enable handling complex numbers in function calculation. turning this
     * off doesn't actually disable complex numbers. it means that functions
     * will not return complex numbers unless one of the arguments is complex.
     * @see https://docs.treb.app/en/complex-numbers
     *
     * in version 25, complex defaults to `off`.
     */
    complex?: 'on' | 'off';

    /**
     * for rendering the imaginary number. this is intended to support
     * switching to a different character for rendering, or adding a leading
     * space/half-space/hair-space.
     *
     * this _does_not_ change how you enter imaginary numbers, you still have
     * to use `i` (lower-case ascii i).
     */
    imaginary_value?: string;

    /**
     * support markdown formatting for text in cells and comments. at the
     * moment we only support bold, italic, and strike text.
     */
    markdown?: boolean;

    /**
     * show tinted colors in toolbar color dropdowns. as of version 25
     * this defaults to true (used to be false).
     */
    tint_theme_colors?: boolean;

    /**
     * show a spinner for long-running operations
     */
    spinner?: boolean;

    /**
     * start with sidebar closed. defaults to false.
     */
    collapsed?: boolean;

    /**
     * show the revert button in the sidebar. see the `Revert` method. this
     * was renamed from `revert` to avoid any ambiguity.
     */
    revert_button?: boolean;
}

/**
 * Structure represents a cell address. Note that row and column are 0-based.
 */
export interface ICellAddress {

    /** 0-based row */
    row: number;

    /** 0-based column */
    column: number;
    absolute_row?: boolean;
    absolute_column?: boolean;
    sheet_id?: number;
}

/**
 * embedded spreadsheet
 */
export declare class EmbeddedSpreadsheet {

    /** document name (metadata) */
    get document_name(): string | undefined;

    /** document name (metadata) */
    set document_name(name: string | undefined);

    /** opaque user data (metadata) */
    get user_data(): unknown;

    /** opaque user data (metadata) */
    set user_data(data: unknown);

    /** current grid scale */
    get scale(): number;

    /** current grid scale */
    set scale(value: number);

    /** headless state */
    get headless(): boolean;

    /** headless state */
    set headless(value: boolean);

    /**
     * state is the current revision of the document. it is preserved any
     * time the document is saved. it should be a consistent indication of
     * the document version and can be used to compare versions.
     *
     * state is an atomically-incrementing integer but rolls over at 2^16.
     */
    get state(): number;

    /**
     * indicates the current revision of the document is not equal to the
     * last-saved revision of the document.
     */
    get dirty(): boolean;

    /**
     * Use this function to batch multiple document changes. Essentially the
     * grid stops broadcasting events for the duration of the function call,
     * and collects them instead. After the function call we update as necessary.
     *
     * @public
     */
    Batch(func: () => void, paint?: boolean): Promise<void>;

    /** set freeze area */
    Freeze(rows?: number, columns?: number): void;

    /** freeze at current selection */
    FreezeSelection(): void;

    /** return current freeze area */
    GetFreeze(): FreezePane;

    /**
     * Update theme from CSS. Because the spreadsheet is painted, not
     * rendered, you need to notifiy us if external style (CSS) properties
     * have changed. We will update and repaint.
     */
    UpdateTheme(): void;

    /**
     * Get sheet ID, by name (sheet name) or index. This may be useful for
     * constructing references programatically.
     *
     * @remarks
     *
     * Sheet IDs are positive integers. IDs are ephemeral, they should not be
     * retained after a document is closed or reloaded. They will likely (almost)
     * always be the same, but that's not guaranteed, so don't rely on them.
     *
     * @param sheet - sheet name or index. sheet names are matched case-insensitively.
     *
     * @returns ID, or undefined if the index is not found (0 is not a valid
     * sheet ID, so you can test for falsy).
     *
     * @public
     */
    GetSheetID(sheet: string | number): number | undefined;

    /**
     * insert a table in the given range. optionally include a totals row.
     * this method does not make any changes to content or layout. it just
     * converts the range to a table.
     *
     * @param reference
     */
    InsertTable(range?: RangeReference, options?: InsertTableOptions): void;
    RemoveTable(range?: RangeReference): void;
    UpdateTableStyle(range?: RangeReference, theme?: TableTheme | number): void;

    /**
     * Add a sheet, optionally named.
     */
    AddSheet(name?: string): number;

    /**
     * Insert an annotation node. Usually this means inserting a chart. Regarding
     * the argument separator, see the Evaluate function.
     *
     * @param formula - annotation formula. For charts, the chart formula.
     * @param type - annotation type. Defaults to `treb-chart`.
     * @param rect - coordinates, or a range reference for layout.
     *
     * @param argument_separator - the argument separator to use when evaluating
     * the function. defaults to current locale.
     */
    InsertAnnotation(formula: string, type?: string, rect?: IRectangle | RangeReference, argument_separator?: ',' | ';'): void;

    /**
     * Insert an image. This method will open a file chooser and (if an image
     * is selected) insert the image into the document.
     */
    InsertImage(): void;

    /**
     * Rename a sheet.
     *
     * @param index - old name or index of sheet. leave undefined to use
     * current active sheet.
     *
     * @public
     */
    RenameSheet(index: string | number | undefined, new_name: string): void;

    /**
     * Delete a sheet.
     *
     * @param index - sheet name or index. Leave undefined to delete the active sheet.
     *
     * @public
     */
    DeleteSheet(index?: string | number): void;

    /**
     * Show or hide sheet. This is a replacement for the `ShowSheet` method,
     * because that name is somewhat ambiguous.
     *
     * @param index - sheet name or index.
     *
     * @public
     */
    HideSheet(index?: number | string, hide?: boolean): void;

    /**
     * Show or hide sheet. This method is deprecated because it's ambiguous.
     * To set a sheet's visibility, use `HideSheet`. To activate a sheet, use
     * `ActivateSheet`.
     *
     * @param index - sheet name or index.
     *
     * @see HideSheet
     * @deprecated Use `HideSheet` instead.
     */
    ShowSheet(index?: number | string, show?: boolean): void;

    /**
     * Activate sheet.
     *
     * @param index - sheet name or index.
     *
     * @public
     */
    ActivateSheet(index: number | string): void;

    /**
     * Set width of column(s).
     *
     * @param column - column, or columns (array), or undefined means all columns
     * @param width - desired width (can be 0) or undefined means 'auto-size'
     *
     * @public
     */
    SetColumnWidth(column?: number | number[], width?: number): void;

    /**
     * Set height of row(s).
     *
     * @param row - row, or rows (array), or undefined means all rows
     * @param height - desired height (can be 0) or undefined means 'auto-size'
     *
     * @public
     */
    SetRowHeight(row?: number | number[], height?: number): void;

    /**
     * Insert row(s).
     *
     * @param before_row - leave undefined to use current selection.
     *
     * @public
     */
    InsertRows(before_row?: number, count?: number): void;

    /**
     * Insert column(s).
     *
     * @param before_column - leave undefined to use current selection.
     *
     * @public
     */
    InsertColumns(before_column?: number, count?: number): void;

    /**
     * Delete row(s).
     *
     * @param start_row - leave undefined to use current selection. in this
     * case the `count` parameter will be ignored and all rows in the selection
     * will be deleted.
     */
    DeleteRows(start_row?: number, count?: number): void;

    /**
     * Delete columns(s).
     *
     * @param start_column - leave undefined to use current selection. in this
     * case the `count` parameter will be ignored and all columns in the
     * selection will be deleted.
     */
    DeleteColumns(start_column?: number, count?: number): void;

    /**
     * filter a table. the reference can be the table name, or a cell in the table.
     * if the reference is an area (range), we're going to look at the top-left
     * cell.
     *
     * this method uses a function to filter rows based on cell values. leave the
     * function undefined to show all rows. this is a shortcut for "unfilter".
     *
     * @param column - the column to sort on. values from this column will be
     * passed to the filter function.
     *
     * @param filter - a callback function to filter based on cell values. this
     * will be called with the cell value (formula), the calculated value (if any),
     * and the cell style. return false to hide the row, and true to show the row.
     * if the filter parameter is omitted, all values will be shown.
     *
     */
    FilterTable(reference: RangeReference, column?: number, filter?: TableFilterFunction): void;

    /**
     * sort a table. the reference can be the table name, or a cell in the table.
     * if the reference is an area (range), we're going to look at the top-left
     * cell.
     */
    SortTable(reference: RangeReference, options?: Partial<TableSortOptions>): void;

    /**
     * Merge cells in range.
     *
     * @param range - target range. leave undefined to use current selection.
     *
     * @public
     */
    MergeCells(range?: RangeReference): void;

    /**
     * Unmerge cells in range.
     *
     * @param range - target range. leave undefined to use current selection.
     *
     * @public
     */
    UnmergeCells(range?: RangeReference): void;

    /**
     * revert to the network version of this document, if both `storage_key`
     * and `network_document` are set.
     */
    Revert(): void;

    /**
     * Export to XLSX file.
     *
     * @remarks
     *
     * this requires a bunch of processing -- one, we do this in a worker, and
     * two, it's demand loaded so we don't bloat up this embed script.
     */
    Export(): void;

    /**
     * Focus the grid.
     *
     * @public
     */
    Focus(): void;

    /**
     * Update layout and repaint if necessary.
     *
     * @remarks
     *
     * This method should be called when the container is resized, to
     * trigger an update to layout. It should be called automatically
     * by a resize observer set in the containing tag class, but you
     * can call it manually if necessary.
     *
     * @public
     */
    Resize(): void;

    /**
     * Clear/reset sheet. This will reset the undo stack as well,
     * so it cannot be undone.
     *
     * @public
     */
    Reset(): void;

    /**
     * load a document from from local storage, using the given key.
     * this method will also set the local option for the storage key, so the
     * document will potentially be saved on modification.
     */
    LoadFromLocalStorage(key: string): boolean;

    /**
     * load a network document by URI. CORS headers must be set appropriately
     * on documents originating from different hosts.
     */
    LoadNetworkDocument(uri: string, options?: EmbeddedSpreadsheetOptions): Promise<void>;

    /**
     * Load a desktop file. This method will show a file chooser and open
     * the selected file (if any).
     *
     * @public
     */
    LoadLocalFile(): Promise<void>;

    /**
     * Export sheet as CSV/TSV. This is an internal method called by the save
     * document methods, but you can call it directly if you want the text as
     * a string.
     *
     * @returns string
     *
     * @public
     */
    ExportDelimited(options?: ExportOptions): string;

    /**
     * Save the current document to a desktop file.
     *
     * @param filename Filename or extension to use the document name.
     *
     * @public
     */
    SaveLocalFile(filename?: string, additional_options?: SaveOptions): void;

    /**
     * Load CSV from string. This is used internally when loading network
     * documents and local files, but you can call it directly if you have
     * a CSV file as text.
     *
     * @public
     */
    LoadCSV(csv: string, source?: LoadSource): void;

    /**
     * get or set the current scroll offset. scroll offset is automatically
     * saved if you save the document or switch tabs; this is for saving/
     * restoring scroll if you cache the containing element.
     */
    ScrollOffset(offset?: Point): Point | undefined;

    /**
     * unserialize document from data.
     */
    LoadDocument(data: any, options?: LoadDocumentOptions): void;

    /**
     * Set note (comment) in cell.
     *
     * @param address target address, or leave undefined to use current selection.
     * @param note note text, or leave undefined to clear existing note.
     */
    SetNote(address: AddressReference | undefined, note?: string): void;

    /**
     * set or clear cell valiation.
     *
     * @param address - target cell
     * @param validation - a spreadsheet range, list of data, or undefined. pass
     * undefined to remove existing cell validation.
     * @param error - setting an invalid value in the target cell is an error (and
     * is blocked). defaults to false.
     */
    SetValidation(address: AddressReference, validation?: RangeReference | CellValue[], error?: boolean): void;

    /**
     * Delete a macro function.
     *
     * @public
     */
    RemoveFunction(name: string): void;

    /**
     * Create a macro function.
     *
     * @public
     */
    DefineFunction(name: string, argument_names?: string | string[], function_def?: string): void;

    /**
     * Serialize document to a plain javascript object. The result is suitable
     * for converting to JSON. This method is used by the SaveLocalFile and
     * SaveLocalStorage methods, but you can call it directly if you want to
     * save the document some other way.
     *
     * @public
     */
    SerializeDocument(options?: SerializeOptions): any;

    /**
     * Recalculate sheet.
     *
     * @public
     */
    Recalculate(): Promise<void>;

    /**
     * Save document to local storage.
     *
     * @param key optional storage key. if omitted, the method will use
     * the key from local options (set at create time).
     */
    SaveLocalStorage(key?: string | undefined): void;

    /**
     * Revert state one level from the undo stack.
     *
     * @public
     */
    Undo(): void;

    /**
     * Show the about dialog.
     *
     * @public
     */
    About(): void;

    /**
     * Scroll to the given address. In the current implementation this method
     * will not change sheets, although it probably should if the reference
     * is to a different sheet.
     *
     * @public
     */
    ScrollTo(address: AddressReference, options?: SheetScrollOptions): void;

    /**
     * Resolve a string address/range to an address or area (range) object.
     *
     * @param reference A string like "A1" or "Sheet1!B2:C3". If a sheet name
     * is not included, the current active sheet is used. You can also pass a
     * named range as reference.
     *
     * @public
     */
    Resolve(reference: string): ICellAddress | IArea | undefined;

    /**
     * Evaluate an arbitrary expression in the spreadsheet. You should generally
     * use sheet names when referring to cells, to avoid ambiguity. Otherwise
     * cell references will resolve to the active sheet.
     *
     * @param expression - an expression in spreadsheet language
     * @param options - options for parsing the passed function
     *
     * @public
     */
    Evaluate(expression: string, options?: EvaluateOptions): CellValue | CellValue[][];

    /**
     * Returns the current selection, as a string address or range.
     *
     * @param qualified include sheet name in result. default true.
     *
     * @returns selection as a string, or empty string if there's no selection.
     *
     * @public
     */
    GetSelection(qualified?: boolean): string;

    /**
     * Parse a string and return a number (if possible).
     *
     * @public
     */
    ParseNumber(text: string): number | Complex | boolean | string | undefined;

    /**
     * Format a number with an arbitrary formatter.
     *
     * @public
     */
    FormatNumber(value: number, format?: string): string;

    /**
     * Apply borders to range.
     *
     * @param range pass `undefined` as range to apply to current selection.
     *
     * @remarks
     *
     * Borders are part of style, but setting/removing borders is more
     * complicated than setting other style properties. usually you want
     * things to apply to ranges, rather than individual cells. removing
     * borders needs to consider neighbor borders. and so on.
     *
     * @public
     */
    ApplyBorders(range: RangeReference | undefined, borders: BorderConstants, width?: number): void;

    /**
     * Apply style to range.
     *
     * @param range pass `undefined` as range to apply to current selection.
     * @param delta apply over existing properties. default true.
     *
     * @remarks
     *
     * Don't use this method to set borders, use `ApplyBorders`.
     *
     * @public
     */
    ApplyStyle(range?: RangeReference, style?: Style.Properties, delta?: boolean): void;

    /**
     * Remove a named range (removes the name, not the range).
     *
     * @public
     */
    ClearName(name: string): void;

    /**
     * Create a named range or named expression. A named range refers to an
     * address or range. A named expression can be a value or formula, basically
     * anything you would type into a cell.
     *
     * @param value range, value or expression
     *
     * @remarks
     *
     * This function used to support passing `undefined` as the value,
     * which meant "create a named range using current selection". We don't
     * support that any more but you can accompilsh that with
     * `sheet.DefineName("Name", sheet.GetSelection())`.
     *
     * @public
     */
    DefineName(name: string, value: RangeReference | CellValue): void;

    /**
     * Set or remove a link in a cell.
     *
     * @param target http/https URL or a spreadsheet reference (as text). set blank to remove link.
     *
     * @public
     */
    SetLink(address?: AddressReference, target?: string): void;

    /**
     * Select a range. This function will change sheets if your reference
     * refers to a different sheet.
     *
     * @public
     */
    Select(range: RangeReference): void;

    /**
     *
     * @param range target range. leave undefined to use current selection.
     *
     * @public
     */
    GetRange(range?: RangeReference, options?: GetRangeOptions): CellValue | CellValue[][] | undefined;

    /**
     * returns the style from the target address or range.
     *
     * @param range - target range. leave undefined to use current selection
     * @param apply_theme - include theme defaults when returning style
     *
     */
    GetStyle(range?: RangeReference, apply_theme?: boolean): Style.Properties | Style.Properties[][] | undefined;

    /**
     * Set data in range.
     *
     * @param range target range. leave undefined to use current selection.
     *
     * @public
     */
    SetRange(range?: RangeReference, data?: CellValue | CellValue[][], options?: SetRangeOptions): void;

    /**
     * Subscribe to spreadsheet events
     * @param subscriber - callback function
     * @returns a token used to cancel the subscription
     */
    Subscribe(subscriber: (event: EmbeddedSheetEvent) => void): number;

    /**
     * Cancel subscription
     * @param token - the token returned from `Subscribe`
     */
    Cancel(token: number): void;
}

/**
 * options for saving files. we add the option for JSON formatting.
 */
export interface SaveOptions extends SerializeOptions {

    /** pretty json formatting */
    pretty?: boolean;
}

/**
 * options for the LoadDocument method
 */
export interface LoadDocumentOptions {
    scroll?: string | ICellAddress;
    flush?: boolean;
    recalculate?: boolean;
    override_sheet?: string;
}

/**
 * options for the GetRange method
 */
export interface GetRangeOptions {

    /**
     * return formatted values (apply number formats and return strings)
     * @deprecated
     */
    formatted?: boolean;

    /**
     * return formulas instead of values. formula takes precedence over
     * "formatted"; if you pass both, returned values will *not* be formatted.
     * @deprecated
     */
    formula?: boolean;

    /**
     * optional style for returned values (replaces old flags).
     *
     * @remarks
     *
     * `formatted` returns formatted values, applying number formatting and
     * returning strings. `formula` returns cell formulas instead of values.
     */
    type?: 'formatted' | 'formula';
}

/**
 * options for the ScrollTo method.
 *
 * @remarks
 *
 * this method was renamed because of a conflict with a DOM type,
 * which was causing problems with the documentation generator.
 */
export interface SheetScrollOptions {

    /** scroll in x-direction. defaults to true. */
    x?: boolean;

    /** scroll in y-direction. defaults to true. */
    y?: boolean;

    /**
     * smooth scrolling, if supported. we use scrollTo so support is as here:
     * https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTo
     */
    smooth?: boolean;
}

/**
 * function type used for filtering tables
 */
export type TableFilterFunction = (value: CellValue, calculated_value: CellValue, style: Style.Properties) => boolean;
export interface FreezePane {
    rows: number;
    columns: number;
}
export declare type BorderConstants = "none" | "all" | "outside" | "top" | "bottom" | "left" | "right";

/**
 * options for serializing data
 */
export interface SerializeOptions {

    /** optimize for size */
    optimize?: 'size' | 'speed';

    /** include the rendered/calculated value in export */
    rendered_values?: boolean;

    /** translate colors to xlsx-friendly values */
    export_colors?: boolean;

    /** export cells that have no value, but have a border or background color */
    decorated_cells?: boolean;

    /** prune unused rows/columns */
    shrink?: boolean;

    /**
     * include tables. tables will be serialized in the model, so we can
     * drop them from cells. but you can leave them in if that's useful.
     */
    tables?: boolean;

    /** share resources (images, for now) to prevent writing data URIs more than once */
    share_resources?: boolean;
}

/**
 * options for the SetRange method
 */
export interface SetRangeOptions {

    /** transpose rectangular array before inserting */
    transpose?: boolean;

    /** recycle values (R-style) */
    recycle?: boolean;

    /** apply as an array (as if you pressed ctrl+shift+enter) */
    array?: boolean;

    /** spill over */
    spill?: boolean;

    /**
     * argument separator to use when parsing the input formula. set this
     * option to call SetRange with a consistent argument separator,
     * independent of current locale.
     */
    argument_separator?: ',' | ';';

    /**
     * allow R1C1-style references; these can be either absolute
     * addresses (e.g. R2C4) or relative to the cell (e.g. R[-3]C[0]).
     */
    r1c1?: boolean;
}

/**
 * Structure represents a 2d range of cells.
 */
export interface IArea {
    start: ICellAddress;
    end: ICellAddress;
}
export interface Point {
    x: number;
    y: number;
}

/** structure represents rectangle coordinates */
export interface IRectangle {
    top: number;
    left: number;
    width: number;
    height: number;
}
export declare namespace Style {

    /**
         * horizontal align constants
         */ type HorizontalAlign = "" | "left" | "center" | "right";

    /**
         * vertical align constants
         */ type VerticalAlign = "" | "top" | "bottom" | "middle";

    /** composite font size */
    interface FontSize {
        unit: 'pt' | 'px' | 'em' | '%';
        value: number;
    }

    /**
     * color is either a theme color (theme index plus tint), or CSS text
     */
    interface Color {
        theme?: number;
        tint?: number;
        text?: string;

        /** @deprecated */
        none?: boolean;
    }

    /**
     * style properties applied to a cell.
     */
    interface Properties {

        /** horizontal align defaults to left */
        horizontal_align?: HorizontalAlign;

        /** vertical align defaults to bottom */
        vertical_align?: VerticalAlign;

        /** representation for NaN */
        nan?: string;

        /** number format, either a symbolic name like "General" or a format string */
        number_format?: string;

        /** wrap text */
        wrap?: boolean;

        /**
         * font size. we recommend using relative font sizes (either % or em)
         * which will be relative to the theme font size.
         */
        font_size?: FontSize;

        /** font face. this can be a comma-delimited list, like CSS */
        font_face?: string;

        /** flag */
        bold?: boolean;

        /** flag */
        italic?: boolean;

        /** flag */
        underline?: boolean;

        /** flag */
        strike?: boolean;

        /** border weight */
        border_top?: number;

        /** border weight */
        border_right?: number;

        /** border weight */
        border_left?: number;

        /** border weight */
        border_bottom?: number;

        /** text color */
        text?: Color;

        /** background color */
        fill?: Color;

        /** border color */
        border_top_fill?: Color;

        /** border color */
        border_left_fill?: Color;

        /** border color */
        border_right_fill?: Color;

        /** border color */
        border_bottom_fill?: Color;

        /**
         * cell is locked for editing
         */
        locked?: boolean;
    }
}
export type CellValue = undefined | string | number | boolean | Complex | DimensionedQuantity;

/**
 * Complex number type
 */
export interface Complex {
    real: number;
    imaginary: number;
}
export interface DimensionedQuantity {
    value: number;
    unit: string;
}

/**
 * composite styling for tables.
 */
export interface TableTheme {

    /** the first row in a table, showing column titles. */
    header?: Style.Properties;

    /**
     * odd rows in the table. we count the title row as zero, so
     * the first row in the table containing data is 1, hence odd.
     */
    odd?: Style.Properties;

    /**
     * even rows in the table.
     */
    even?: Style.Properties;

    /**
     * styling for the totals row, if included. this will be the last
     * row in the table.
     */
    total?: Style.Properties;
}

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, or a string.
 */
export type AddressReference = string | ICellAddress;

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, an area (range) object, or a string.
 */
export type RangeReference = string | ICellAddress | IArea;
export interface TableSortOptions {

    /**
     * when sorting, column is relative to the table (and 0-based). so the
     * first column in the table is 0, regardless of where the table is in
     * the spreadsheet. defaults to 0, if not specified.
     */
    column: number;

    /**
     * sort type. defaults to 'auto'. 'auto' looks at the values in the column,
     * and uses text sort if there are more strings, or numeric if there are
     * more numbers. if it's even, sorts as text.
     */
    type: TableSortType;

    /** ascending sort. defaults to true. */
    asc: boolean;
}
export type TableSortType = 'text' | 'numeric' | 'auto';
export declare type LoadSource = "drag-and-drop" | "local-file" | "network-file" | "local-storage" | "undo";

/**
 * EmbeddedSheetEvent is a discriminated union. Switch on the `type` field
 * of the event.
 */
export type EmbeddedSheetEvent = DocumentChangeEvent | DocumentResetEvent | DocumentLoadEvent | DataChangeEvent | FocusViewEvent | SelectionEvent | ResizeEvent;

/**
 * options when inserting a table into a sheet
 */
export interface InsertTableOptions {

    /**
     * include a totals/summation row. this impacts the layout and styling:
     * totals row have a unique style and are not included when sorting.
     * defaults to true.
     */
    totals_row?: boolean;

    /**
     * show a sort button in table headers. defaults to true.
     */
    sortable?: boolean;

    /**
     * base theme color, or a set of styles for the table. useful values for
     * theme color are accent colors 4 (the default), 5, 7 and 9.
     */
    theme?: number | TableTheme;
}
export interface ResizeEvent {
    type: 'resize';
}
export declare type LoadType = "treb" | "csv" | "xlsx";

/**
 * This event is sent when a document is loaded, and also on undo. The
 * source field can help determine if it was triggered by an undo operation.
 */
export interface DocumentLoadEvent {
    type: 'load';
    source?: LoadSource;
    file_type?: LoadType;
}

/**
 * This event is sent when the document is reset.
 */
export interface DocumentResetEvent {
    type: 'reset';
}

/**
 * This event is sent when data in the spreadsheet changes, but there are
 * no structural or cell changes. For example, the `RAND` function returns
 * a new value on every calculation, but the function itself does not change.
 */
export interface DataChangeEvent {
    type: 'data';
}

/**
 * This event is sent when the value of a cell changes, or when the document
 * structure chages. Structure changes might be inserting/deleting rows or
 * columns, or adding/removing a sheet.
 */
export interface DocumentChangeEvent {
    type: 'document-change';
}

/**
 * This event is sent when the spreadsheet selection changes. Use the
 * `GetSelection` method to get the address of the current selection.
 */
export interface SelectionEvent {
    type: 'selection';
}

/**
 * This event is sent when the focused view changes, if you have more
 * than one view.
 */
export interface FocusViewEvent {
    type: 'focus-view';
}

/**
 * options for exporting CSV/TSV
 */
export interface ExportOptions {

    /** comma or tab */
    delimiter?: ',' | '\t';

    /** optionally choose a sheet to export (defaults to active sheet) */
    sheet?: string | number;

    /** export formulas not values */
    formulas?: boolean;

    /** use number formats when exporting numbers */
    formatted?: boolean;
}

/**
 * options for the evaluate function
 */
export interface EvaluateOptions {

    /**
     * argument separator to use when parsing input. set this option to
     * use a consistent argument separator independent of current locale.
     */
    argument_separator?: ',' | ';';

    /**
     * allow R1C1-style references. the Evaluate function cannot use
     * relative references (e.g. R[-1]C[0]), so those will always fail.
     * however it may be useful to use direct R1C1 references (e.g. R3C4),
     * so we optionally support that behind this flag.
     */
    r1c1?: boolean;
}
