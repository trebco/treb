/*! API v31.3. Copyright 2018-2024 trebco, llc. All rights reserved. LGPL: https://treb.app/license */

/**
 * add our tag to the map
 */
declare global {
  interface HTMLElementTagNameMap {
    'treb-spreadsheet': HTMLElement & {
      instance: {
        sheet: EmbeddedSpreadsheet | undefined;
      } | undefined;
    };
  }
}
/**
 * API class for creating spreadsheets. this is intended as a singleton,
 * we will export an instance of the class.
 */
export declare class TREBGlobal {

    /**
     * Package version
     */
    version: string;

    /**
     * Create a spreadsheet. The `USER_DATA_TYPE` template parameter is the type
     * assigned to the `user_data` field of the spreadsheet instance -- it can
     * help simplify typing if you are storing extra data in spreadsheet
     * files.
     *
     * Just ignore this parameter if you don't need it.
     *
     * @typeParam USER_DATA_TYPE - type for the `user_data` field in the
     * spreadsheet instance
     */
    CreateSpreadsheet<USER_DATA_TYPE = unknown>(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet<USER_DATA_TYPE>;
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
     * @deprecated - this was renamed to local_storage for clarity. if both
     * storage_key and local_storage are set we will use the value in local_storage.
     */
    storage_key?: string | boolean;

    /**
     * persist user changes to document in browser localStorage.
     *
     * if set to a string, the value is used as the storage key.
     *
     * if set to `true`, we will generate a storage key based on the page URI.
     * don't do that if you have multiple spreadsheets on a single page, or
     * they will overwrite each other.
     */
    local_storage?: string | boolean;

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

    /** even if we allow resizing, constrain width. this is to support fixed width columns. */
    constrain_width?: boolean;

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

    /**
     * allow add/delete tab
     */
    add_tab?: boolean;

    /**
     * show delete tab
     * @deprecated - implied by add_tab
     */
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

    /** include the font stack control in the toolbar */
    font_stack?: boolean;

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

    /**
     * show the revert indicator. this is an indicator that shows on the
     * top-left of the spreadsheet when a network document has local changes.
     */
    revert_indicator?: boolean;

    /**
     * handle the F9 key and recalculate the spreadsheet. for compatibility.
     * we're leaving this option to default `false` for now, but that may
     * change in the future. key modifiers have no effect.
     */
    recalculate_on_f9?: boolean;

    /**
     * indent/outdent buttons; default false
     */
    indent_buttons?: boolean;

    /**
     * enable spill arrays and spill references. this is on by default
     * starting in 30.1.0. set to false to disable.
     */
    spill?: boolean;

    /**
     * language. at the moment this controls spreadsheet function names
     * only; the plan is to expand to the rest of the interface over time.
     * should be an ISO 639-1 language code, like "en", "fr" or "sv" (case
     * insensitive). we only support a limited subset of languages at the
     * moment.
     *
     * leave blank or set to "locale" to use the current locale.
     */
    language?: string;
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

    /** spill reference */
    spill?: boolean;
}

/**
 * embedded spreadsheet
 */
export declare class EmbeddedSpreadsheet<USER_DATA_TYPE = unknown> {

    /**
     * convenience function returns the name of the active sheet. if the
     * sheet name has spaces or other characters that require quoting, it
     * will be quoted using single quotes.
     */
    get active_sheet(): string;

    /** document name (metadata) */
    get document_name(): string | undefined;

    /** document name (metadata) */
    set document_name(name: string | undefined);

    /**
     * opaque user data (metadata). `USER_DATA_TYPE` is a template
     * parameter you can set when creating the spreadsheet.
     */
    get user_data(): USER_DATA_TYPE | undefined;

    /**
     * opaque user data (metadata). `USER_DATA_TYPE` is a template
     * parameter you can set when creating the spreadsheet.
     */
    set user_data(data: USER_DATA_TYPE | undefined);

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
     * this flag indicates we can revert the document. what that means is
     * we loaded a user-created version from localStorage, but there's a
     * backing network or inline document. or we did load the original version
     * but the user has made some document changes.
     *
     * it's like `dirty`, but that uses the load source as the ground truth,
     * which means if you load a modified document from localStorage it's
     * initially considered not-dirty (which is maybe just a bad design?)
     *
     * the intent of this field is to support enabling/disabling revert
     * logic, or to add a visual indicator that you are not looking at the
     * canonical version.
     */
    get can_revert(): boolean;

    /**
     * indicates the current revision of the document is not equal to the
     * last-saved revision of the document.
     */
    get dirty(): boolean;

    /**
     * explicitly set or clear the dirty flag. it's intended for use by clients
     * that have their own save routine.
     */
    set dirty(value: boolean);

    /**
     * returns the names of all sheets in the current document
     */
    get sheet_names(): string[];

    /**
     * set or remove an external editor. external editor is an interface used
     * to support outside tooling by highlighting a list of arguments and
     * responding to selection.
     */
    ExternalEditor(config?: Partial<ExternalEditorConfig>): void;

    /**
     * @internalRemarks removing internal flag
     */
    ConditionalFormatDuplicateValues(range: RangeReference | undefined, options: ConditionalFormatDuplicateValuesOptions): ConditionalFormat;

    /**
     * @internalRemarks removing internal flag
     */
    ConditionalFormatGradient(range: RangeReference | undefined, options: ConditionalFormatGradientOptions | StandardGradient): ConditionalFormat;

    /**
     * @internalRemarks removing internal flag
     */
    ConditionalFormatCellMatch(range: RangeReference | undefined, options: ConditionalFormatCellMatchOptions): ConditionalFormat;

    /**
     * @internalRemarks removing internal flag
     */
    ConditionalFormatExpression(range: RangeReference | undefined, options: CondifionalFormatExpressionOptions): ConditionalFormat;

    /**
     * remove conditional format
     *
     * @internalRemarks removing internal flag
     */
    RemoveConditionalFormat(format: ConditionalFormat): void;

    /**
     * clear conditional formats from the target range (or currently selected
     * range). we operate on format objects, meaning we'll remove the whole
     * format object rather than clip the area.
     *
     * @internalRemarks removing internal flag
     */
    RemoveConditionalFormats(range?: RangeReference): void;

    /** dynamically load language module */
    LoadLanguage(language?: string): Promise<void>;

    /**
     * Use this function to batch multiple document changes. Essentially the
     * grid stops broadcasting events for the duration of the function call,
     * and collects them instead. After the function call we update as necessary.
     */
    Batch(func: () => void, paint?: boolean): void;

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
    RemoveConnectedChart(id: number): void;
    UpdateConnectedChart(id: number, formula: string): void;

    /**
     * Insert an annotation node. Usually this means inserting a chart. Regarding
     * the argument separator, see the Evaluate function.
     *
     * @param formula - annotation formula. For charts, the chart formula.
     * @param type - annotation type. Defaults to `treb-chart`.
     * @param rect - coordinates, or a range reference for layout.
     * @param options - evaluate options. because this function used to take
     *  the argument separator, we allow that to be passed directly, but this
     *  is deprecated. new code should use the options object.
     */
    InsertAnnotation(formula: string, type?: AnnotationType, rect?: IRectangle | RangeReference, options?: EvaluateOptions | ',' | ';'): void;

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

    /** list sheets in the model */
    ListSheets(): {
        name: string;
        hidden?: boolean;
    }[];

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
     * revert to the network version of this document, if `local_storage`
     * is set and the create options had either `document` or `inline-document`
     * set.
     *
     * FIXME: we should adjust for documents that fail to load.
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
     * @deprecated - use SaveToDesktop
     *
     * @param filename
     * @param additional_options
     */
    SaveLocalFile(filename?: string, additional_options?: SaveOptions): void;

    /**
     * Save the current document to a desktop file. This is the new version
     * of the method, renamed from SaveLocalFile.
     *
     * @param filename Filename or extension to use the document name.
     */
    SaveToDesktop(filename?: string, additional_options?: SaveOptions): void;

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
    LoadDocument(data: TREBDocument, options?: LoadDocumentOptions): void;

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
     * @param target - target cell/area
     * @param validation - a spreadsheet range, list of data, or undefined. pass
     * undefined to remove existing cell validation.
     * @param error - setting an invalid value in the target cell is an error (and
     * is blocked). defaults to false.
     */
    SetValidation(target: RangeReference, validation?: RangeReference | CellValue[], error?: boolean): void;

    /**
     * Delete a macro function.
     *
     * @public
     */
    RemoveFunction(name: string): void;

    /**
     * Create a macro function.
     *
     * FIXME: this needs a control for argument separator, like other
     * functions that use formulas (@see SetRange)
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
    SerializeDocument(options?: SerializeOptions): TREBDocument;

    /**
     * Recalculate sheet.
     *
     * @public
     */
    Recalculate(): void;

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
     * scroll the given address into view. it could be at either side
     * of the window. optionally use smooth scrolling.
     */
    ScrollIntoView(address: AddressReference, smooth?: boolean): void;

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
     * Convert an address/range object to a string. this is a convenience
     * function for composing formulas.
     *
     * @param ref sheet reference as a string or structured object
     * @param [qualified=true] include sheet names
     * @param [named=true] resolve to named ranges, where applicable
     */
    Unresolve(ref: RangeReference, qualified?: boolean, named?: boolean): string;

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
    FormatNumber(value: number | Complex, format?: string): string;

    /**
     * convert a javascript date (or timestamp) to a spreadsheet date
     */
    SpreadsheetDate(javascript_date: number | Date): number;

    /**
     * convert a spreadsheet date to a javascript date
     */
    JavascriptDate(spreadsheet_date: number): number;

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
    ApplyStyle(range?: RangeReference, style?: CellStyle, delta?: boolean): void;

    /**
     * Remove a named range (removes the name, not the range).
     *
     * @public
     */
    ClearName(name: string): void;

    /**
     * Create a named range or named expression. A named range refers to an
     * address or range. A named expression can be any value or formula. To set
     * the value as a literal string, enclose the string in double-quotes (as
     * you would when using a string as a function argument).
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
    DefineName(name: string, value: RangeReference | CellValue, scope?: string | number, overwrite?: boolean): void;

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
     * refers to a different sheet. if the argument is undefined or falsy
     * it will remove the selection (set to no selection).
     *
     * @public
     */
    Select(range?: RangeReference): void;

    /**
     * override for paste method omits the data parameter.
     */
    Paste(target?: RangeReference, options?: PasteOptions): void;

    /**
     * standard paste method accepts data argument
     *
     * @param target
     * @param data
     * @param options
     */
    Paste(target?: RangeReference, data?: ClipboardData, options?: PasteOptions): void;

    /**
     * copy data. this method returns the copied data. it does not put it on
     * the system clipboard. this is for API access when the system clipboard
     * might not be available.
     */
    Copy(source?: RangeReference): ClipboardData;

    /**
     * cut data. this method returns the cut data. it does not put it on the
     * system clipboard. this method is similar to the Copy method, with
     * two differences: (1) we remove the source data, effectively clearing
     * the source range; and (2) the clipboard data retains references, meaning
     * if you paste the data in a different location it will refer to the same
     * cells.
     */
    Cut(source?: RangeReference): ClipboardData;

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
    GetStyle(range?: RangeReference, apply_theme?: boolean): CellStyle | CellStyle[][] | undefined;

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
     * by default, GetRange returns cell values. the optional type field
     * can be used to returns data in different formats.
     *
     * @remarks
     *
     * `formatted` returns formatted values, applying number formatting and
     * returning strings.
     *
     * `A1` returns cell formulas instead of values, in A1 format.
     *
     * `R1C1` returns cell formauls in R1C1 format.
     *
     * `formula` is an alias for 'A1', for backwards compatibility.
     *
     */
    type?: 'formatted' | 'A1' | 'R1C1' | 'formula';
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
export type TableFilterFunction = (value: CellValue, calculated_value: CellValue, style: CellStyle) => boolean;
export interface FreezePane {
    rows: number;
    columns: number;
}
export interface CondifionalFormatExpressionOptions {
    style: CellStyle;
    expression: string;
    options?: EvaluateOptions;
}
export interface ConditionalFormatGradientOptions {

    /** property defaults to fill */
    property?: 'fill' | 'text';

    /** defaults to RGB */
    color_space?: 'HSL' | 'RGB';

    /** gradient stops, required */
    stops: Array<{
        value: number;
        color: Color;
    }>;

    /** min and max are optional. if not provided, we use the min/max of the range of data. */
    min?: number;

    /** min and max are optional. if not provided, we use the min/max of the range of data. */
    max?: number;
}
export type StandardGradient = keyof typeof StandardGradientsList;
export interface ConditionalFormatCellMatchOptions {
    style: CellStyle;
    expression: string;
    options?: EvaluateOptions;
}
export interface ConditionalFormatDuplicateValuesOptions {
    style: CellStyle;

    /** true to highlight unique cells, false to highlight duplicates. defaults to false. */
    unique?: boolean;
}

/**
 * union, plus we're adding a state used to track application.
 * that state is serialized if it's true.
 * we also add an internal field that will be type-specific, and not serialized.
 *
 * ...everybody has a vertex now, we could standardize it
 *
 * update: adding a priority field, optional
 *
 */
export type ConditionalFormat = {
    internal?: unknown;
    priority?: number;
} & (ConditionalFormatDuplicateValues | ConditionalFormatExpression | ConditionalFormatCellMatch | ConditionalFormatGradient);

/**
 * conditional format predicated on an expression. if the expression
 * evaluates to true, we apply the style. otherwise no.
 */
export interface ConditionalFormatExpression extends CondifionalFormatExpressionOptions {
    type: 'expression';
    area: IArea;
}
export interface ConditionalFormatGradient extends ConditionalFormatGradientOptions {
    type: 'gradient';
    area: IArea;
}
export interface ConditionalFormatCellMatch extends ConditionalFormatCellMatchOptions {
    type: 'cell-match';
    area: IArea;
}
export interface ConditionalFormatDuplicateValues extends ConditionalFormatDuplicateValuesOptions {
    type: 'duplicate-values';
    area: IArea;
}

/**
 * Structure represents a 2d range of cells.
 */
export interface IArea {
    start: ICellAddress;
    end: ICellAddress;
}
export type Color = ThemeColor | HTMLColor | NullColor;

/**
 * style properties applied to a single cell, row, column, or sheet.
 * when rendering a cell, we composite all styles that might apply.
 */
export interface CellStyle {

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

    /** text indent */
    indent?: number;

    /**
     * cell is locked for editing
     */
    locked?: boolean;
}

/** horizontal align constants for cell style */
export type HorizontalAlign = '' | 'left' | 'center' | 'right';

/** vertical align constants for cell style */
export type VerticalAlign = '' | 'top' | 'bottom' | 'middle';
export type ThemeColorType = 'Background' | 'Text' | 'Background2' | 'Text2' | 'Accent' | 'Accent2' | 'Accent3' | 'Accent4' | 'Accent5' | 'Accent6';

/**
 * font size for cell style. we generally prefer relative sizes
 * (percent or em) because they are relative to the default theme
 * size, which might be different on different platforms.
 */
export interface FontSize {
    unit: 'pt' | 'px' | 'em' | '%';
    value: number;
}
export interface HTMLColor {
    text: string;
}
export interface ThemeColor {
    theme: number | ThemeColorType;
    tint?: number;
}
export interface NullColor {
}
export declare const ThemeColorIndex: (color: ThemeColor) => number;
export declare const IsHTMLColor: (color?: Color) => color is HTMLColor;
export declare const IsThemeColor: (color?: Color) => color is ThemeColor;
export declare const IsDefinedColor: (color?: Color) => color is (ThemeColor | HTMLColor);

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

    /**
     * if a function has an export() handler, call that
     */
    export_functions?: boolean;
}
export type AnnotationType = 'treb-chart' | 'image' | 'textbox' | 'external';
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
export type CellValue = undefined | string | number | boolean | Complex | DimensionedQuantity;

/**
 * Complex number type
 */
export interface Complex {
    real: number;
    imaginary: number;
}

/**
 * dimensioned quantity: 3.2 m/s, 2kg, 5m, &c.
 */
export interface DimensionedQuantity {
    value: number;
    unit: string;
}

/**
 * composite styling for tables.
 */
export interface TableTheme {

    /** the first row in a table, showing column titles. */
    header?: CellStyle;

    /**
     * odd rows in the table. we count the title row as zero, so
     * the first row in the table containing data is 1, hence odd.
     */
    odd?: CellStyle;

    /**
     * even rows in the table.
     */
    even?: CellStyle;

    /**
     * styling for the totals row, if included. this will be the last
     * row in the table.
     */
    total?: CellStyle;
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

/** clipboard data is a 2d array */
export type ClipboardData = ClipboardDataElement[][];

/**
 * optional paste options. we can paste formulas or values, and we
 * can use the source style, target style, or just use the source
 * number formats.
 */
export interface PasteOptions {

    /**
     * when clipboard data includes formulas, optionally paste calculated
     * values instead of the original formulas. defaults to false.
     */
    values?: boolean;

    /**
     * when pasting data from the clipboard, we can copy formatting/style
     * from the original data, or we can retain the target range formatting
     * and just paste data. a third option allows pasting source number
     * formats but dropping other style information.
     *
     * defaults to "source", meaning paste source styles.
     */
    formatting?: 'source' | 'target' | 'number-formats';
}

/**
 * this is a structure for copy/paste data. clipboard data may include
 * relative formauls and resolved styles, so it's suitable for pasting into
 * other areas of the spreadsheet.
 */
export interface ClipboardDataElement {

    /** calculated cell value */
    calculated: CellValue;

    /** the actual cell value or formula */
    value: CellValue;

    /** cell style. this may include row/column styles from the copy source */
    style?: CellStyle;

    /** area. if this cell is part of an array, this is the array range */
    area?: IArea;
}
export declare type BorderConstants = "none" | "all" | "outside" | "top" | "bottom" | "left" | "right";

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
export interface ExternalEditorConfig {

    /**
     * list of dependencies to highlight. we support undefined entries in
     * this list so you can use the result of `EmbeddedSpreadsheet.Resolve`,
     * which may return undefined.
     */
    dependencies: DependencyList;

    /**
     * this callback will be called when the selection changes in the
     * spreadsheet and this external editor is active. return an updated
     * list of dependencies to highlight.
     *
     * NOTE: this is currently synchronous, but don't rely on that. it
     * might switch to async in the future depending on how it works in
     * practice.
     */
    update: ExternalEditorCallback;

    /**
     * a list of nodes that will serve as editors. when you attach, we will do
     * an initial pass of context highlighting. we highlight on text changes
     * and insert references if you make a selection in the spreadsheet while
     * an editor is focused.
     */
    nodes: HTMLElement[];

    /**
     * assume that we're editing a formula. does not require leading `=`.
     * defaults to `true` for historical reasons.
     */
    assume_formula?: boolean;
}
export type DependencyList = Array<IArea | ICellAddress | undefined>;
export type ExternalEditorCallback = (selection?: string) => DependencyList | undefined;

/**
 * this is the document type used by TREB. it has a lot of small variations
 * for historical reasons and backwards compatibility. usually it's preferable
 * to let TREB create and manage these documents rather than creating them
 * manually.
 */
export interface TREBDocument {

    /** app name, as identifier */
    app: string;

    /** app version. we'll warn if you use a file from a newer version */
    version: string;

    /**
     * revision number. this is a value that increments on any document change,
     * useful for checking if a document is "dirty".
     */
    revision?: number;

    /** document name */
    name?: string;

    /**
     * opaque user data. we don't read or parse this, but applications can
     * use it to store arbitrary data.
     */
    user_data?: unknown;

    /**
     * per-sheet data. this should be an array, but for historical reasons
     * we still support a single sheet outside of an array.
     */
    sheet_data?: SerializedSheet | SerializedSheet[];

    /** document decimal mark */
    decimal_mark?: '.' | ',';

    /** active sheet. if unset we'll show the first un-hidden sheet */
    active_sheet?: number;

    /**
     * this document includes rendered calculated values. using this lets the
     * app show a document faster, without requiring an initial calculation.
     */
    rendered_values?: boolean;

    /** document named ranges @deprecated */
    named_ranges?: Record<string, IArea>;

    /** document named expressions @deprecated */
    named_expressions?: SerializedNamedExpression[];

    /**
     * new consolidated named ranges & expressions
     */
    named?: SerializedNamed[];

    /** document macro functions */
    macro_functions?: SerializedMacroFunction[];

    /** document tables */
    tables?: Table[];

    /** document shared resources (usually images) */
    shared_resources?: Record<string, string>;
}
export declare type LoadSource = "drag-and-drop" | "local-file" | "network-file" | "local-storage" | "inline-document" | "undo";

/**
 * EmbeddedSheetEvent is a discriminated union. Switch on the `type` field
 * of the event.
 */
export type EmbeddedSheetEvent = DocumentChangeEvent | DocumentResetEvent | DocumentLoadEvent | ThemeChangeEvent | ViewChangeEvent | DataChangeEvent | FocusViewEvent | SelectionEvent | ResizeEvent | AnnotationSelectionEvent;

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
 * This event is sent when the view changes -- at the moment, that only
 * means the view scale has been changed. We might use it in the future
 * for other things.
 */
export interface ViewChangeEvent {
    type: 'view-change';
}

/**
 * this event is sent when the theme is updated. it's intended for any
 * subscribers to update corresponding colors or fonts.
 */
export interface ThemeChangeEvent {
    type: 'theme-change';
}

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
 * this event is used when an annotation is selected. we're not changing
 * the original selection event, because I don't want to break anything.
 */
export interface AnnotationSelectionEvent {
    type: 'annotation-selection';
}

/**
 * This event is sent when the focused view changes, if you have more
 * than one view.
 */
export interface FocusViewEvent {
    type: 'focus-view';
}

/**
 * serialized type is a composite of expression/range. we determine
 * what it is when parsing the expression. this simplifies passing these
 * things around.
 *
 * (named expressions and ranges they have slightly different behavior,
 * which is why we have a distinction at all).
 *
 */
export interface SerializedNamed {
    name: string;

    /** expression or address/area */
    expression: string;

    /** scope is a sheet name (not ID) */
    scope?: string;
}
export interface SerializedSheet {

    /** cell data */
    data: SerializedCellData;

    /** top-level sheet style, if any */
    sheet_style: CellStyle;

    /** row count */
    rows: number;

    /** column count */
    columns: number;

    /**
     * cell styles is for empty cells that have styling
     */
    cell_styles: CellStyleRecord[];

    /**
     * @deprecated use `styles` instead
     */
    cell_style_refs?: CellStyle[];

    /**
     * new implementation
     */
    styles?: CellStyle[];

    /**
     * per-row styles
     */
    row_style: Record<number, CellStyle | number>;

    /**
     * per-column styles
     */
    column_style: Record<number, CellStyle | number>;

    /**
     * @deprecated no one uses this anymore and it's weird
     */
    row_pattern?: CellStyle[];

    /** default for new rows */
    default_row_height?: number;

    /** default for new columns */
    default_column_width?: number;

    /** list of row heights. we use a Record instead of an array because it's sparse */
    row_height?: Record<number, number>;

    /** list of column widths. we use a Record instead of an array because it's sparse */
    column_width?: Record<number, number>;

    /**
     * @deprecated these were moved to the containing document
     */
    named_ranges?: Record<string, IArea>;
    freeze?: FreezePane;

    /** sheet ID, for serializing references */
    id?: number;

    /** sheet name */
    name?: string;

    /** tab color */
    tab_color?: Color;

    /** current active selection */
    selection: SerializedGridSelection;

    /**  */
    annotations?: Partial<AnnotationData>[];

    /** current scroll position */
    scroll?: ScrollOffset;

    /** visible flag. we only support visible/hidden */
    visible?: boolean;

    /** testing */
    background_image?: string;
}
export interface ScrollOffset {
    x: number;
    y: number;
}
export interface CellStyleRecord {
    row: number;
    column: number;
    ref: number;
    rows?: number;
}
export type SerializedCellData = CellDataWithAddress[] | NestedRowData[] | NestedColumnData[];
export interface BaseCellData {
    value: CellValue;
    style_ref?: number;
    calculated?: CellValue;
    table?: Table;
    area?: IArea;
    merge_area?: IArea;
    calculated_type?: SerializedValueType;
    note?: string;
    hyperlink?: string;
    type?: SerializedValueType;
    sheet_id?: number;
    spill?: IArea;
}

/**
 * this type is for serialized data that includes the row and column
 * in each cell. this was the original serialized data type, and is
 * still supported. current serialization will group data into rows or
 * columns, whichever results in a smaller overall serialized representation.
 */
export interface CellDataWithAddress extends BaseCellData {
    row: number;
    column: number;
}
export interface NestedCellData {
    cells: BaseCellData[];
}

/**
 * this type is for serialized data that is grouped by row, with each
 * cell referencing a column in the spreadsheet.
 */
export interface CellDataWithColumn extends BaseCellData {
    column: number;
}
export interface NestedRowData extends NestedCellData {
    row: number;
    cells: CellDataWithColumn[];
}

/**
 * this type is for serialized data that is grouped by column, with each
 * cell referencing a row in the spreadsheet.
 */
export interface CellDataWithRow extends BaseCellData {
    row: number;
}
export interface NestedColumnData extends NestedCellData {
    column: number;
    cells: CellDataWithRow[];
}

/**
 * struct representing a table
 */
export interface Table {

    /**
     * table must have a name
     */
    name: string;

    /** table area */
    area: IArea;

    /**
     * table column headers. normalize case before inserting.
     */
    columns?: string[];

    /**
     * table has a totals row. this impacts layout and what's included
     * in the range when you refer to a column. also on import/export, the
     * AutoFilter element should exclude the totals row.
     *
     * NOTE: xlsx actually uses an integer for this -- can it be > 1?
     */
    totals_row?: boolean;

    /**
     * table is sortable. defaults to true. if false, disables UI sorting.
     */
    sortable?: boolean;

    /**
     * theme for table. we have a default, but you can set explicitly.
     */
    theme?: TableTheme;

    /**
     * sort data. sorts are hard, meaning we actually move data around.
     * (not meaning difficult). we may keep track of the last sort so we
     * can toggle asc/desc, for example. atm this will not survive serialization.
     */
    sort?: TableSortOptions;
}

/**
 * string types for import/export
 *
 * @internalRemarks
 *
 * temporarily switching to literal, see what happens to API
 *
 */
export type SerializedValueType = // typeof ValueTypeList[number];
'undefined' | 'formula' | 'string' | 'number' | 'boolean' | 'object' | 'error' | 'complex' | 'array' | 'dimensioned_quantity';

/**
 * temporarily splitting into a serialized version that uses IArea instead
 * of Area. we should do this for the actual selection type, but it breaks
 * too many things atm to do that immediately. TODO/FIXME.
 */
export interface SerializedGridSelection {

    /** target or main cell in the selection */
    target: ICellAddress;

    /** selection area */
    area: IArea;

    /** there is nothing selected, even though this object exists */
    empty?: boolean;

    /** for cacheing addtional selections. optimally don't serialize */
    rendered?: boolean;
}
export type AnnotationData = AnnotationChartData | AnnotationImageData | AnnotationExternalData | AnnotationTextBoxData;
export interface ImageSize {
    width: number;
    height: number;
}
export interface ImageAnnotationData {
    src: string;

    /**/
    scale?: string;
    original_size?: ImageSize;
}

/**
 * splitting persisted data from the annotation class. that class might
 * disappear in the future in favor of just a type. this interface should
 * fully match the old Partial<Annotation> we used before. note that we
 * used to define values for all members, but they may now be undefined
 * because the Annotation class as a Partial instance of this data.
 *
 * conceptually annotation was originally intended to support types other
 * than our own charts and images, but no one ever used it. so we could
 * lock down the `type` field if we wanted to. or perhaps have an `external`
 * type with opaque data. TODO.
 *
 */
export interface AnnotationDataBase {

    /** the new layout, persisted and takes preference over the old one */
    layout?: AnnotationLayout;

    /**
     * adding cell style as a convenient store for font stack; atm we are
     * ignoring everything but the font_face attribute
     */
    style?: CellStyle;

    /**
     * the old layout used rectangles, and we need to keep support for
     * that. this is not the layout rectangle. this rectangle is just
     * for serialization/deserialization. the actual rectangle is maintained
     * in the Annotation class.
     */
    rect?: Partial<IRectangle>;

    /** annotation can be resized. this is advisory, for UI */
    resizable: boolean;

    /** annotation can be moved. this is advisory, for UI */
    movable: boolean;

    /** annotation can be removed/deleted. this is advisory, for UI */
    removable: boolean;

    /** annotation can be selected. this is advisory, for UI */
    selectable: boolean;

    /** move when resizing/inserting rows/columns */
    move_with_cells: boolean;

    /** resize when resizing/inserting rows/columns */
    resize_with_cells: boolean;

    /**
     * optional formula. the formula will be updated on structure events
     * (insert/delete row/column).
     */
    formula: string;

    /**
     * extent, useful for exporting. we could probably serialize this,
     * just be sure to clear it when layout changes so it will be
     * recalculated.
     *
     * the idea is to know the bottom/right row/column of the annotation,
     * so when we preserve/restore the sheet we don't trim those rows/columns.
     * they don't need any data, but it just looks bad. we can do this
     * dynamically but since it won't change all that often, we might
     * as well precalculate.
     */
    extent: ICellAddress;
}
export interface AnnotationImageData extends AnnotationDataBase {
    type: 'image';
    data: ImageAnnotationData;
}
export interface AnnotationChartData extends AnnotationDataBase {
    type: 'treb-chart';
}
export interface AnnotationTextBoxData extends AnnotationDataBase {
    type: 'textbox';
    data: {
        style?: CellStyle;
        paragraphs: {
            style?: CellStyle;
            content: {
                text: string;
                style?: CellStyle;
            }[];
        }[];
    };
}
export interface AnnotationExternalData extends AnnotationDataBase {
    type: 'external';
    data: Record<string, string>;
}

/**
 * represents the layout of an annotation, reference to the sheet
 */
export interface AnnotationLayout {
    tl: Corner;
    br: Corner;
}

/**
 * offset from corner, as % of cell
 */
export interface AddressOffset {
    x: number;
    y: number;
}

/**
 * represents one corner of a layout rectangle
 */
export interface Corner {
    address: ICellAddress;
    offset: AddressOffset;
}
export interface SerializedMacroFunction {
    name: string;
    function_def: string;
    argument_names?: string[];
    description?: string;
}

/**
 * this type is no longer in use, but we retain it to parse old documents
 * that use it.
 *
 * @deprecated
 */
export interface SerializedNamedExpression {
    name: string;
    expression: string;
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
