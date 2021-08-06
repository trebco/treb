
/*! API v12.0. Copyright 2018-2021 Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */
export interface SaveOptions extends SerializeOptions {

    /** pretty json formatting */
    pretty?: boolean;

}

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, or a string.
 */
export declare type AddressReference = string | ICellAddress;

/**
 * type represents a reference passed in to API functions. it can be an
 * address object, an area (range) object, or a string.
 */
export declare type RangeReference = string | ICellAddress | IArea;

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
     */
    formatted?: boolean;

    /**
     * return formulas instead of values. formula takes precedence over
     * "formatted"; if you pass both, returned values will *not* be formatted.
     *
     * FIXME: that should throw?
     */
    formula?: boolean;

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

}

/**
 * options for the ScrollTo method
 */
export interface ScrollToOptions {

    /** scroll in x-direction. defaults to true. */
    x?: boolean;

    /** scroll in y-direction. defaults to true. */
    y?: boolean;

    /**
     * smooth scrolling, if supported. we use scrollTo so support is as here:
     * https://www.google.com/search?q=mdn+scrollto
     */
    smooth?: boolean;

}

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
    set scale(value: number);

    /** current grid scale */
    get scale(): number;

    /** headless state */
    get headless(): boolean;

    /** headless state */
    set headless(value: boolean);

    constructor(options: EmbeddedSpreadsheetOptions);

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
     * @param sheet sheet name or index. sheet names are matched case-insensitively.
     *
     * @returns ID, or undefined if the index is not found (0 is not a valid
     * sheet ID, so you can test for falsy).
     *
     * @public
     */
    GetSheetID(sheet: string | number): number | undefined;

    /**
     * Add a sheet, optionally named.
     */
    AddSheet(name?: string): void;

    /**
     * Insert an annotation node. Usually this means inserting a chart.
     *
     * @param formula Annotation formula. For charts, the chart formula.
     * @param type Annotation type. Defaults to `treb-chart`.
     * @param rect Coordinates, or a range reference for layout.
     */
    InsertAnnotation(formula: string, type?: string, rect?: Partial<Rectangle> | RangeReference): void;

    /**
     * Insert an image. This method will open a file chooser and (if an image
     * is selected) insert the image into the document.
     *
     */
    InsertImage(file?: File): Promise<void>;

    /**
     * Rename a sheet.
     *
     * @param index old name or index of sheet. leave undefined to use
     * current active sheet.
     *
     * @public
     */
    RenameSheet(index: string | number | undefined, new_name: string): void;

    /**
     * Delete a sheet.
     *
     * @param index Sheet name or index. Leave undefined to delete the active sheet.
     *
     * @public
     */
    DeleteSheet(index?: string | number): void;

    /**
     * Show or hide sheet. This is a replacement for the `ShowSheet` method,
     * because that name is somewhat ambiguous.
     *
     * @param index Sheet name or index.
     *
     * @public
     */
    HideSheet(index?: number | string, hide?: boolean): void;

    /**
     * Show or hide sheet.
     *
     * @param index Sheet name or index.
     *
     * @see HideSheet
     * @deprecated Use `HideSheet` instead.
     */
    ShowSheet(index?: number | string, show?: boolean): void;

    /**
     * Activate sheet.
     *
     * @param index Sheet name or index.
     *
     * @public
     */
    ActivateSheet(index: number | string): void;

    /**
     * Set width of column(s).
     *
     * @param column column, or columns (array), or undefined means all columns
     * @param width desired width (can be 0) or undefined means 'auto-size'
     *
     * TODO: this method assumes the current sheet. we need a method that can
     * (optionally) specify a sheet.
     *
     * @public
     */
    SetColumnWidth(column?: number | number[], width?: number): void;

    /**
     * Set height of row(s).
     *
     * @param row row, or rows (array), or undefined means all rows
     * @param height desired height (can be 0) or undefined means 'auto-size'
     *
     * TODO: this method assumes the current sheet. we need a method that can
     * (optionally) specify a sheet.
     *
     * @public
     */
    SetRowHeight(row?: number | number[], height?: number): void;

    /**
     * Insert row(s).
     *
     * @param before_row leave undefined to use current selection.
     *
     * @public
     */
    InsertRows(before_row?: number, count?: number): void;

    /**
     * Insert column(s).
     *
     * @param before_column leave undefined to use current selection.
     *
     * @public
     */
    InsertColumns(before_column?: number, count?: number): void;

    /**
     * Delete row(s).
     *
     * @param start_row leave undefined to use current selection. in this
     * case the `count` parameter will be ignored and all rows in the selection
     * will be deleted.
     */
    DeleteRows(start_row?: number, count?: number): void;

    /**
     * Delete columns(s).
     *
     * @param start_column leave undefined to use current selection. in this
     * case the `count` parameter will be ignored and all columns in the
     * selection will be deleted.
     */
    DeleteColumns(start_column?: number, count?: number): void;

    /**
     * Merge cells in range.
     *
     * @range target range. leave undefined to use current selection.
     *
     * @public
     */
    MergeCells(range?: RangeReference): void;

    /**
     * Unmerge cells in range.
     *
     * @range target range. leave undefined to use current selection.
     *
     * @public
     */
    UnmergeCells(range?: RangeReference): void;

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
     * Call this method when the container is resized. It's not necessary
     * if the resize is triggered by our resize handle, only if the container
     * is resized externally.
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
     * @returns boolean, where true indicates we have successfully loaded a file.
     * false could be a load error or user cancel from the dialog.
     *
     * @public
     */
    LoadLocalFile(): Promise<boolean>;

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
    LoadCSV(csv: string): void;

    /**
     * unserialize document from data
     *
     * UPDATE: will no longer recalculate on load if the "rendered_values"
     * flag is set in the document (assuming it's correct), because we can
     * display those values.
     *
     * UPDATE: default scroll to A1 in open sheet
     *
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
    ScrollTo(address: AddressReference, options?: ScrollToOptions): void;

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
     * @public
     */
    Evaluate(expression: string): CellValue | CellValue[][];

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
     * Create a named range.
     *
     * @param range leave undefined to use current selection
     *
     * @public
     */
    DefineName(name: string, range?: RangeReference): void;

    /**
     * Set or remove a link in a cell.
     *
     * @param target http/https URL or a spreadsheet reference (as text). set blank to remove link.
     *
     * @public
     */
    SetLink(address?: AddressReference, target?: string): void;

    /**
     * Select a range.
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
    GetRange(range?: RangeReference, options?: GetRangeOptions): CellValue | CellValue[][];

    /**
     * Set data in range.
     *
     * @param range target range. leave undefined to use current selection.
     *
     * @public
     */
    SetRange(range?: RangeReference, data?: CellValue | CellValue[][], options?: SetRangeOptions): void;

}
