/*! API v13.4. Copyright 2018-2021 Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */

/** 
 * Global instance. In the base script, this object will be created as an
 * ambient global object (bound to the window object). If you instead use the
 * ES module, import the TREB object from the module.
 */
 declare const TREB: TREBGlobal;

/**
 * global object used to create spreadsheets
 */
export declare class TREBGlobal {

  /** TREB version */
  version: string;

  /** create a spreadsheet */
  CreateSpreadsheet(options: EmbeddedSpreadsheetOptions): EmbeddedSpreadsheet;

}
/**
 * options for saving files. we add the option for JSON formatting.
 */
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
 * embedded spreadsheet
 */
export declare class EmbeddedSpreadsheet<CalcType extends Calculator = Calculator> {

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
     * Add a sheet, optionally named.
     */
    AddSheet(name?: string): void;

    /**
     * Insert an annotation node. Usually this means inserting a chart.
     *
     * @param formula - annotation formula. For charts, the chart formula.
     * @param type - annotation type. Defaults to `treb-chart`.
     * @param rect - coordinates, or a range reference for layout.
     */
    InsertAnnotation(formula: string, type?: string, rect?: IRectangle | RangeReference): void;

    /**
     * Insert an image. This method will open a file chooser and (if an image
     * is selected) insert the image into the document.
     *
     **/
    InsertImage(file?: File): Promise<void>;

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
     * Show or hide sheet.
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
    LoadCSV(csv: string, source?: LoadSource): void;

    /**
     * unserialize document from data.
     *
     **/
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
export declare enum BorderConstants {
    None = "none",
    All = "all",
    Outside = "outside",
    Top = "top",
    Bottom = "bottom",
    Left = "left",
    Right = "right",
    DoubleTop = "double-top",
    DoubleBottom = "double-bottom"
}

/**
 * options for serializing data
 *
 **/
export interface SerializeOptions {

    /** include the rendered/calculated value in export */
    rendered_values?: boolean;

    /** translate colors to xlsx-friendly values */
    export_colors?: boolean;

    /** export cells that have no value, but have a border or background color */
    decorated_cells?: boolean;

    /** prune unused rows/columns */
    shrink?: boolean;
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
 * Structure represents a 2d range of cells.
 *
 **/
export interface IArea {
    start: ICellAddress;
    end: ICellAddress;
}

/** structure represents rectangle coordinates */
export interface IRectangle {
    top: number;
    left: number;
    width: number;
    height: number;
}
export declare namespace Style {

    /** horizontal align constants */
    enum HorizontalAlign {
        None = 0,
        Left = 1,
        Center = 2,
        Right = 3
    }

    /** vertical align constants */
    enum VerticalAlign {
        None = 0,
        Top = 1,
        Bottom = 2,
        Middle = 3
    }

    /** composite font size */
    interface FontSize {
        unit: 'pt' | 'px' | 'em' | '%';
        value: number;
    }

    /**
     * color is either a theme color (theme index plus tint), or CSS text
     *
     **/
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
export declare type CellValue = undefined | string | number | boolean | Complex;

/**
 * Complex number type
 */
export interface Complex {
    real: number;
    imaginary: number;
}

/**
 * Calculator now extends graph. there's a 1-1 relationship between the
 * two, and we wind up passing a lot of operations from one to the other.
 * this also simplifies the callback structure, as we can use local methods.
 *
 * NOTE: graph vertices hold references to cells. while that makes lookups
 * more efficient, it causes problems if you mutate the sheet (adding or
 * removing rows or columns).
 *
 * in that event, you need to flush the graph to force rebuilding references
 * (TODO: just rebuild references). after mutating the sheet, call
 * ```
 * Calculator.Reset();
 * ```
 *
 */
export declare class Calculator extends Graph {
    readonly parser: Parser;
    constructor();

    /**
     * this is a mess [not as bad as it used to be]
     */
    SpreadCallback(vertex: SpreadsheetVertex, value: UnionValue): void;

    /**
     * FIXME: for this version, this should be synchronous; the whole thing
     * should run in a worker. should be much faster than context switching
     * every time.
     */
    CalculationCallback(vertex: SpreadsheetVertex): CalculationResult;

    /**
     * generic function, broken out from the Indirect function. checks dynamic
     * dependency for missing edges, and adds those edges.
     *
     * returns error on bad reference or circular dependency. this method
     * does not set the "short circuit" flag, callers should set as appropriate.
     */
    DynamicDependencies(expression: ExpressionUnit, context?: ICellAddress, offset?: boolean, offset_rows?: number, offset_columns?: number, resize_rows?: number, resize_columns?: number): {
        dirty: boolean;
        area: Area;
    } | undefined;

    /**
     * if locale has changed in Localization, update local resources.
     * this is necessary because (in chrome) worker doesn't get the system
     * locale properly (also, we might change it via parameter). we used to
     * just drop and reconstruct calculator, but we want to stop doing that
     * as part of supporting dynamic extension.
     */
    UpdateLocale(): void;

    /**
     * lookup in function library
     *
     * it seems like the only place this is called is within this class,
     * so we could probably inline and drop this function
     *
     * @deprecated
     */
    GetFunction(name: string): ExtendedFunctionDescriptor;

    /**
     * returns a list of available functions, for AC/tooltips
     * FIXME: categories?
     * FIXME: need to separate annotation functions and sheet functions
     */
    SupportedFunctions(): FunctionDescriptor[];

    /**
     * dynamic extension
     * TODO: support updating AC (need grid change, possibly call from EmbeddedSheet)
     * FIXME: this is going to break in simulations (maybe not an issue?)
     */
    RegisterFunction(map: FunctionMap): void;

    /**
     * wrap the attachdata function so we can update the expression calculator
     * at the same time (we should unwind this a little bit, it's an artifact
     * of graph being a separate class)
     */
    AttachModel(model: DataModel): void;

    /**
     * wrapper method for calculation. this should be used for 1-time
     * calculations (i.e. not in a simulation).
     */
    Calculate(model: DataModel, subset?: Area): void;

    /**
     * resets graph and graph status
     */
    Reset(): void;

    /**
     * get a list of functions that require decorating with "_xlfn" on
     * export. the embed caller will pass this to the export worker.
     * since we manage functions, we can manage the list.
     *
     * UPDATE: to support our MC functions (which may need _xll decoration),
     * map to type and then overload as necessary
     *
     */
    DecoratedFunctionList(): Record<string, string>;

    /** wrapper method ensures it always returns an Area (instance, not interface) */
    ResolveArea(address: string | ICellAddress | IArea): Area;

    /**
     * moved from embedded sheet. also modified to preserve ranges, so it
     * might return a range (area). if you are expecting the old behavior
     * you need to check (perhaps we could have a wrapper, or make it optional?)
     *
     * Q: why does this not go in grid? or model? (...)
     * Q: why are we not preserving absoute/relative? (...)
     *
     */
    ResolveAddress(address: string | ICellAddress | IArea): ICellAddress | IArea;

    /** moved from embedded sheet */
    Evaluate(expression: string): any;

    /**
     * calculate an expression, optionally setting a fake cell address.
     * this may have weird side-effects.
     */
    CalculateExpression(expression: ExpressionUnit, address?: ICellAddress, preserve_flags?: boolean): UnionValue;

    /**
     * rebuild the graph, and set cells as clean. the vertices need internal
     * references to the calculated value, so that's set via the vertex method.
     *
     * we also need to manage the list of volatile cells, which is normally
     * built as a side-effect of calculation.
     *
     * UPDATE: optionally recalculate if there are volatile cells. that's used
     * for loading documents.
     */
    RebuildClean(model: DataModel, recalculate_if_volatile?: boolean): void;

    /**
     * remove duplicates from list, dropping absolute
     */
    FlattenCellList(list: ICellAddress[]): ICellAddress[];

    /**
     * get a list of cells that need metadata. this is for passing to
     * the simulation as additional cells
     */
    MetadataReferences(formula: string): ICellAddress[];
    RemoveAnnotation(annotation: Annotation): void;
    UpdateAnnotations(list?: Annotation | Annotation[]): void;

    /**
     * returns false if the sheet cannot be resolved, which probably
     * means the name changed (that's the case we are working on with
     * this fix).
     */
    ResolveSheetID(expr: UnitAddress | UnitRange, context?: ICellAddress): boolean;
}

/**
 * graph is now abstract, as we are extending it with the calculator.
 */
export declare abstract class Graph implements GraphCallbacks {

    /**
     * list of vertices, indexed by address as [sheet id][column][row]
     */
    vertices: Array<Array<Array<SpreadsheetVertex | undefined>>>;
    volatile_list: SpreadsheetVertexBase[];
    calculation_list: SpreadsheetVertexBase[];
    cells_map: {
        [index: number]: Cells;
    };
    model?: DataModel;

    /**
     * where is the loop in the graph (or at least the first one we found)?
     */
    loop_hint?: string;
    leaf_vertices: LeafVertex[];
    IsSpreadsheetVertex(vertex: Vertex): vertex is SpreadsheetVertex;

    /**
     * flush the graph, calculation tree and cells reference
     */
    FlushTree(): void;
    ResolveArrayHead(address: ICellAddress): ICellAddress;

    /** overload */
    GetVertex(address: ICellAddress, create: true): SpreadsheetVertex;

    /** overload */
    GetVertex(address: ICellAddress, create?: boolean): SpreadsheetVertex | undefined;

    /** deletes the vertex at this address. */
    RemoveVertex(address: ICellAddress): void;

    /** removes all edges, for rebuilding. leaves value/formula as-is. */
    ResetVertex(address: ICellAddress): void;

    /**
     * resets the vertex by removing inbound edges and clearing formula flag.
     * we have an option to set dirty because they get called together
     * frequently, saves a lookup.
     */
    ResetInbound(address: ICellAddress, set_dirty?: boolean, create?: boolean, remove?: boolean): void;

    /**
     * reset all vertices. this method is used so we can run the loop check
     * as part of the graph calculation, instead of requiring the separate call.
     */
    ResetLoopState(): void;

    /**
     * global check returns true if there is any loop. this is more efficient
     * than detecting loops on every call to AddEdge. uses the color algorithm
     * from CLRS.
     *
     * UPDATE we switched to a stack-based check because we were hitting
     * recursion limits, although that seemed to only happen in workers --
     * perhaps they have different stack [in the malloc sense] sizes? in any
     * event, I think the version below is now stable.
     *
     * @param force force a check, for dev/debug
     */
    LoopCheck(force?: boolean): boolean;

    /**
     * render address as string; this is for reporting loops
     */
    RenderAddress(address?: ICellAddress): string;

    /**
     * new array vertices
     */
    AddArrayEdge(u: Area, v: ICellAddress): void;

    /** adds an edge from u -> v */
    AddEdge(u: ICellAddress, v: ICellAddress, tag?: string): void;

    /** removes edge from u -> v */
    RemoveEdge(u: ICellAddress, v: ICellAddress): void;

    /**
     * not used? remove
     * @deprecated
     */
    SetAreaDirty(area: IArea): void;
    SetVertexDirty(vertex: SpreadsheetVertexBase): void;

    /** sets dirty */
    SetDirty(address: ICellAddress): void;

    /**
     * adds a leaf vertex to the graph. this implies that someone else is
     * managing and maintaining these vertices: we only need references.
     */
    AddLeafVertex(vertex: LeafVertex): void;

    /** removes vertex, by match */
    RemoveLeafVertex(vertex: LeafVertex): void;

    /**
     * adds an edge from u -> v where v is a leaf vertex. this doesn't use
     * the normal semantics, and you must pass in the actual vertex instead
     * of an address.
     *
     * there is no loop check (leaves are not allowed to have outbound
     * edges).
     */
    AddLeafVertexEdge(u: ICellAddress, v: LeafVertex): GraphStatus;

    /** removes edge from u -> v */
    RemoveLeafVertexEdge(u: ICellAddress, v: LeafVertex): void;
    InitializeGraph(): void;

    /** runs calculation */
    Recalculate(): void;
    abstract CalculationCallback(vertex: SpreadsheetVertexBase): CalculationResult;
    abstract SpreadCallback(vertex: SpreadsheetVertexBase, value: UnionValue): void;
}
export declare enum GraphStatus {
    OK = 0,
    Loop = 1,
    CalculationError = 2
}
export interface CalculationResult {
    value: UnionValue;
    volatile?: boolean;
}

/**
 * this is a subset of Graph so we can avoid the circular dependency.
 */
export interface GraphCallbacks {
    CalculationCallback: (vertex: SpreadsheetVertexBase) => CalculationResult;
    SpreadCallback: (vertex: SpreadsheetVertexBase, value: UnionValue) => void;
    volatile_list: SpreadsheetVertexBase[];
    calculation_list: SpreadsheetVertexBase[];
}
export declare abstract class SpreadsheetVertexBase extends Vertex {
    dirty: boolean;
    abstract Calculate(graph: GraphCallbacks): void;
}

/** switch to a discriminated union. implicit type guards! */
export declare type UnionValue = NumberUnion | ArrayUnion | ComplexUnion | ExtendedUnion | StringUnion | FormulaUnion | UndefinedUnion | BooleanUnion | ErrorUnion;
export interface NumberUnion {
    type: ValueType.number;
    value: number;
}
export interface StringUnion {
    type: ValueType.string;
    value: string;
}
export interface ErrorUnion {
    type: ValueType.error;
    value: string;
}
export interface FormulaUnion {
    type: ValueType.formula;
    value: string;
}
export interface BooleanUnion {
    type: ValueType.boolean;
    value: boolean;
}

/** we should have these for other types as well */
export interface ComplexUnion {
    type: ValueType.complex;
    value: Complex;
}
export interface UndefinedUnion {
    type: ValueType.undefined;
    value?: undefined;
}
export interface ExtendedUnion {
    type: ValueType.object;
    value: any;
    key?: string;
}

/** potentially recursive structure */
export interface ArrayUnion {
    type: ValueType.array;
    value: UnionValue[][];
}

/**
 * I _think_ using enums is faster. I'm not actually sure about that, though.
 * it stands to reason that a single int compare is faster than a string
 * compare, but you never know with javascript. undefined preferred over null.
 * formula implies a string.
 *
 * undefined is 0 so we can test it as falsy.
 *
 * we're passing this type information out to calculators, so it needs
 * to have known values. DO NOT MODIFY EXISTING INDEXES, or at least be
 * aware of the implications. definitely do not change undefined => 0.
 */
export declare enum ValueType {
    undefined = 0,
    formula = 1,
    string = 2,
    number = 3,
    boolean = 4,
    object = 5,
    error = 6,
    complex = 7,
    array = 8
}
export declare class Vertex {

    /**
     * vertex and its subclasses have a type parameter for type
     * guards/reflection; each instance has a type that is set
     * to the static class type.
     */
    static type: string;
    type: string;
    color: Color;

    /** dependencies */
    edges_in: Vertex[];

    /** dependents */
    edges_out: Vertex[];
    get has_inbound_edges(): boolean;
    get has_outbound_edges(): boolean;

    /** reset this node */
    Reset(): void;

    /** removes all inbound edges (dependencies) */
    ClearDependencies(): void;

    /** add a dependent. doesn't add if already in the list */
    AddDependent(edge: Vertex): void;

    /** remove a dependent */
    RemoveDependent(edge: Vertex): void;

    /** add a dependency. doesn't add if already in the list */
    AddDependency(edge: Vertex): void;

    /** remove a dependency */
    RemoveDependency(edge: Vertex): void;

    /**
     * this is a composite operation, because the operations are always called
     * in pairs. this means create a pair of links such that _edge_ depends on
     * _this_.
     */
    LinkTo(edge: Vertex): void;

    /**
     * this is an alteranate formulation that may make more intuitive sense.
     * it creates a pair of forward/backward links, such that _this_ depends
     * on _edge_.
     */
    DependsOn(edge: Vertex): void;

    /**
     * this is called during calculation (if necessary). on a hit (loop), we
     * reset the color of this, the test node, to white. there are two reasons
     * for this:
     *
     * one, we want subsequent tests to also find the hit. in some cases we may
     * not be marking the node as a loop (if it precedes the backref in the graph),
     * so we want subsequent nodes to also hit the loop. [Q: this makes no sense,
     * because this would still hit if the node were marked grey, assuming you
     * test for that].
     *
     * two, if you fix the loop, on a subsequent call we want to force a re-check,
     * which we can do if the vertex is marked white. [Q: could also be done on
     * gray?]
     *
     * [A: logically you are correct, but this works, and matching grey does not].
     */
    LoopCheck(): boolean;
}

/**
 * colors for the CLRS color algorithm.
 *
 * these colors are useful because gray is "in between" white and black, but
 * (outside of the general move away from using white/black as identifiers) it
 * might be easier to conceptualize with descriptive labels like "untested"
 * (white), "being tested", (gray) and "testing complete" (black).
 */
export declare enum Color {
    white = 0,
    gray = 1,
    black = 2
}

/**
 * specialization of vertex with attached data and calculation metadata
 */
export declare class SpreadsheetVertex extends SpreadsheetVertexBase {
    static type: string;
    reference?: Cell;
    error: SpreadsheetError;
    address?: ICellAddress;
    result: UnionValue;
    expression: ExpressionUnit;
    expression_error: boolean;
    short_circuit: boolean;
    type: string;

    /**
     * it seems like this could be cached, if it gets checked a lot
     * also what's with the crazy return signature? [fixed]
     */
    get array_head(): boolean;

    /**
     * to support restoring cached values (from file), we need a way to get
     * the value from the reference (cell). normally this is done during
     * calculation, and in reverse (we set the value).
     *
     * some additional implications of this:
     *
     * - does not set volatile/nonvolatile, which is usually managed as a
     *   side-effect of the calculation.
     *
     * - does not remove the entry from the dirty list
     *
     * - does not clear the internal dirty flag. it used to do that, but we
     *   took it out because we are now managing multple vertex types, and
     *   we don't want to attach that behavior to a type-specific method.
     *
     * so the caller needs to explicitly address the dirty and volatile lists
     * for this vertex.
     */
    TakeReferenceValue(): void;

    /**
     * calculates the function, but only if all dependencies are clean.
     * if one or more dependencies are dirty, just exit. this should work out
     * so that when the last dependency is satisfied, the propagation will
     * succeed. FIXME: optimize order.
     *
     * FIXME: why is this in vertex, instead of graph? [a: dirty check?]
     * A: for overloading. leaf extends this class, and has a separate
     * calculation routine.
     */
    Calculate(graph: GraphCallbacks): void;
}
export declare enum SpreadsheetError {
    None = 0,
    CalculationError = 1
}
export declare class Cell {
    static StringToColumn(s: string): number;
    value?: CellValue;
    type: ValueType;
    calculated?: CellValue;
    calculated_type?: ValueType;
    formatted?: string | TextPart[];
    rendered_type?: ValueType;
    style?: Style.Properties;

    /** if this cell is part of an array, pointer to the area. */
    area?: Area;

    /**
     * if this cell is merged, pointer to the area
     */
    merge_area?: Area;

    /**
     * opaque data for cell rendering, we can cache some data
     * that's reused frequently (is that wasting space?)
     *
     * render data will be flushed any time there is any change to
     * the cell data or style.
     *
     * UPDATE: renderer data is no longer flushed. we set a dirty flag.
     *
     */
    renderer_data?: any;
    render_dirty: boolean;
    note?: string;

    /**
     * moving hyperlink in here, as a cell property. hyperlink will not be
     * removed on value change, but will be removed on clear/delete.
     */
    hyperlink?: string;
    editing?: boolean;

    /**
     * TODO: add a return value which affects control flow. default/falsy should
     * behave as now, for backwards compatibility; but it should be possible to
     * return a value that says "don't exit the standard rendering process"
     *
     * UPDATE: return value now means "I have handled this", so if you paint you
     * should return true. that's a breaking change but we should get help from
     * tooling.
     */
    render_function?: RenderFunction;
    click_function?: ClickFunction;

    /**
     * moving locked property to style. not because it's properly a style,
     * or not properly a property of cell, but rather because that will allow
     * us to cascade the property over areas.
     */

    /** not editable */
    validation?: DataValidation;
    constructor(value?: any, value_type?: ValueType);

    /** type guard */
    ValueIsNumber(): this is {
        value: number;
    };

    /** type guard */
    ValueIsFormula(): this is {
        value: string;
    };

    /** type guard */
    ValueIsBoolean(): this is {
        value: boolean;
    };

    /** type guard */
    ValueIsComplex(): this is {
        value: Complex;
    };

    /** flush style information and things that rely on it (formatted value) */
    FlushStyle(): void;

    /** flush array information */
    FlushArray(): void;

    /** flush cached data: formatted and calculated */
    FlushCache(): void;
    Reset(): void;
    Set(value: CellValue, type?: ValueType): void;

    /** sets calculated value and flushes cached value */
    SetCalculatedValue(value: CellValue, type?: ValueType): void;

    /**
     * composite method for setting value or error, based on value
     */
    SetCalculatedValueOrError(value: any, type?: ValueType): void;

    /**
     * get value -- calculation result (not formatted) or literal. for
     * literal strings, we strip leading apostrophes (these are used to
     * prevent parsing of literal strings that look like other things).
     */
    GetValue(): CellValue;

    /**
     * this function follows the rule of GetValue3, which is: if the type
     * is a function but there is no calculated value, then return 0.
     */
    GetValue4(): UnionValue;

    /**
     * set note. set undefined to clear.
     */
    SetNote(note?: string): void;

    /** sets error (FIXME: error type) */
    SetCalculationError(err?: string): void;
    SetArray(area: Area): void;
    SetArrayHead(area: Area, value: CellValue): void;
}
export interface RenderFunctionOptions {
    height: number;
    width: number;
    context: CanvasRenderingContext2D;
    cell: Cell;
    style: Style.Properties;
    scale?: number;
}
export interface RenderFunctionResult {
    handled: boolean;
}
export declare type RenderFunction = (options: RenderFunctionOptions) => RenderFunctionResult;
export interface ClickFunctionOptions {
    cell: Cell;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scale?: number;
}
export interface ClickFunctionResult {

    /**
     * change the cell value, to the value passed here
     */
    value?: CellValue;

    /**
     * set to true to block normal click handling semantics
     * (selecting the cell, generally)
     */
    block_selection?: boolean;
}
export declare type ClickFunction = (options: ClickFunctionOptions) => ClickFunctionResult;

/**
 * restructuring from the old system, which had lots of separate arrays for
 * things. for the most part I think having a single array (or object) with
 * objects will be more useful (if not necessarily more efficient). the
 * standout case where this will be inefficient is in passing data to a
 * calculation service, where style information is not useful.
 *
 * things that are in the cell class:
 *  - raw data (formula or value)
 *  - formatted representation
 *  - type (data type including formula or value, implicitly)
 *  - array pointer -- if this cell is part of an array, the array object
 *
 * things that are NOT in the cell class:
 *  - raw per-cell style information. this is in a separate array (object).
 */

/**
 * validation TODO: date, number, boolean, &c
 */
export declare enum ValidationType {
    List = 0,
    Date = 1,
    Range = 2,
    Number = 3,
    Boolean = 4
}
export interface DataValidationRange {
    type: ValidationType.Range;
    area: IArea;
}
export interface DataValidationList {
    type: ValidationType.List;
    list: CellValue[];
}
export interface DataValidationDate {
    type: ValidationType.Date;
}
export interface DataValidationNumber {
    type: ValidationType.Number;
}
export interface DataValidationBoolean {
    type: ValidationType.Boolean;
}
export declare type DataValidation = DataValidationList | DataValidationRange | DataValidationNumber | DataValidationDate | DataValidationBoolean;

/**
 * class represents a rectangular area on a sheet. can be a range,
 * single cell, entire row/column, or entire sheet.
 *
 * "entire" row/column/sheet is represented with an infinity in the
 * start/end value for row/column/both, so watch out on loops. the
 * sheet class has a method for reducing infinite ranges to actual
 * populated ranges.
 */
export declare class Area implements IArea {

    /**
     *
     * @param start
     * @param end
     * @param normalize: calls the normalize function
     */
    constructor(start: ICellAddress, end?: ICellAddress, normalize?: boolean);
    static FromColumn(column: number): Area;
    static FromRow(row: number): Area;
    static ColumnToLabel(c: number): string;
    static CellAddressToLabel(address: ICellAddress, sheet_id?: boolean): string;

    /**
     * merge two areas and return a new area.
     * UPDATE to support arbitrary arguments
     */
    static Join(base: IArea, ...args: Array<IArea | undefined>): Area;

    /**
     * creates an area that expands the original area in all directions
     * (except at the top/left edges)
     */
    static Bleed(area: IArea, length?: number): Area;

    /** accessor returns a _copy_ of the start address */
    get start(): ICellAddress;

    /** accessor */
    set start(value: ICellAddress);

    /** accessor returns a _copy_ of the end address */
    get end(): ICellAddress;

    /** accessor */
    set end(value: ICellAddress);

    /** returns number of rows, possibly infinity */
    get rows(): number;

    /** returns number of columns, possibly infinity */
    get columns(): number;

    /** returns number of cells, possibly infinity */
    get count(): number;

    /** returns flag indicating this is the entire sheet, usually after "select all" */
    get entire_sheet(): boolean;

    /** returns flag indicating this range includes infinite rows */
    get entire_column(): boolean;

    /** returns flag indicating this range includes infinite columns */
    get entire_row(): boolean;
    PatchNull(address: ICellAddress): ICellAddress;
    SetSheetID(id: number): void;
    Normalize(): void;

    /** returns the top-left cell in the area */
    TopLeft(): ICellAddress;

    /** returns the bottom-right cell in the area */
    BottomRight(): ICellAddress;
    ContainsRow(row: number): boolean;
    ContainsColumn(column: number): boolean;
    Contains(address: ICellAddress): boolean;

    /**
     * returns true if this area completely contains the argument area
     * (also if areas are ===, as a side effect). note that this returns
     * true if A contains B, but not vice-versa
     */
    ContainsArea(area: Area): boolean;

    /**
     * returns true if there's an intersection. note that this won't work
     * if there are infinities -- needs real area ?
     */
    Intersects(area: Area): boolean;
    Equals(area: Area): boolean;
    Clone(): Area;
    Array(): ICellAddress[];
    get left(): Area;
    get right(): Area;
    get top(): Area;
    get bottom(): Area;

    /** shifts range in place */
    Shift(rows: number, columns: number): Area;

    /** Resizes range in place so that it includes the given address */
    ConsumeAddress(addr: ICellAddress): void;

    /** Resizes range in place so that it includes the given area (merge) */
    ConsumeArea(area: IArea): void;

    /** resizes range in place (updates end) */
    Resize(rows: number, columns: number): Area;
    Iterate(f: (...args: any[]) => any): void;

    /**
     * returns the range in A1-style spreadsheet addressing. if the
     * entire sheet is selected, returns nothing (there's no way to
     * express that in A1 notation). returns the row numbers for entire
     * columns and vice-versa for rows.
     */
    get spreadsheet_label(): string;

    /**
     * FIXME: is this different than what would be returned if
     * we just used the default json serializer? (...)
     */
    toJSON(): any;
}
export interface TextPart {
    text: string;
    flag?: TextPartFlag;
}
export declare enum TextPartFlag {

    /** just render */
    default = 0,

    /** not rendered, but included in layout (spacing) */
    hidden = 1,

    /** takes up all available space */
    padded = 2,

    /** date component, needs to be filled */
    date_component = 3,

    /** special flag for minutes (instead of months), which is contextual */
    date_component_minutes = 4,

    /** literal (@): reflect the original */
    literal = 5,

    /** formatting (e.g. [red]) */
    formatting = 6
}

/** discriminated union for type guards */
export declare type ExpressionUnit = UnitLiteral | UnitComplex | UnitArray | UnitIdentifier | UnitCall | UnitMissing | UnitGroup | UnitOperator | UnitBinary | UnitUnary | UnitAddress | UnitRange;

/**
 * base type, for common data (atm only ID). id is intended to support
 * a unique ID within the context of a single parse pass. (NOTE: in theory
 * you could use the 'position' field... although that's not present in
 * all cases?)
 */
export interface BaseUnit {
    id: number;
}

/**
 * expression unit representing a literal: string, number, boolean.
 */
export interface UnitLiteral extends BaseUnit {
    type: 'literal';
    position: number;
    value: string | boolean | number;
    text?: string;
}

/**
 * testing: complex
 */
export interface UnitComplex extends BaseUnit {
    type: 'complex';
    position: number;
    real: number;
    imaginary: number;
    text?: string;

    /**
     * this flag takes the place of the old "imaginary" unit type;
     * it's an indication that this unit has been composited, so don't
     * do it again. not sure this is actually needed by the parser... is it?
     */
    composited?: boolean;
}

/**
 * expression unit representing an array of primitive values. array
 * can contain mixed values, and holes. array cannot contain arrays,
 * or any other complex type.
 */
export interface UnitArray extends BaseUnit {
    type: 'array';
    position: number;
    values: Array<Array<string | boolean | number | undefined>>;
}

/**
 * expression unit representing a missing value, intended for missing
 * arguments in function calls.
 */
export interface UnitMissing extends BaseUnit {
    type: 'missing';
}

/**
 * expression unit representing an opaque name or identifier.
 */
export interface UnitIdentifier extends BaseUnit {
    type: 'identifier';
    position: number;
    name: string;
}

/**
 * expression unit representing a group of units; like parentheses in an
 * expression. intended to prevent precendence reordering of operations.
 */
export interface UnitGroup extends BaseUnit {
    type: 'group';
    elements: ExpressionUnit[];
    explicit: boolean;
}

/**
 * expression unit representing a function call: has call and arguments.
 */
export interface UnitCall extends BaseUnit {
    type: 'call';
    name: string;
    position: number;
    args: ExpressionUnit[];
}

/**
 * this isn't an output type (unless parsing fails), but it's useful
 * to be able to pass these around with the same semantics.
 */
export interface UnitOperator extends BaseUnit {
    type: 'operator';
    position: number;
    operator: string;
}

/**
 * expression unit representing a binary operation. operations may be
 * re-ordered based on precendence.
 */
export interface UnitBinary extends BaseUnit {
    type: 'binary';
    left: ExpressionUnit;
    operator: string;
    right: ExpressionUnit;
    position: number;
}

/**
 * expression unit representing a unary operation.
 */
export interface UnitUnary extends BaseUnit {
    type: 'unary';
    operator: string;
    operand: ExpressionUnit;
    position: number;
}

/**
 * expression unit representing a spreadsheet address
 */
export interface UnitAddress extends BaseUnit {
    type: 'address';
    sheet?: string;
    sheet_id?: number;
    label: string;
    row: number;
    column: number;
    absolute_row?: boolean;
    absolute_column?: boolean;
    position: number;
}

/**
 * expression unit representing a spreadsheet range
 */
export interface UnitRange extends BaseUnit {
    type: 'range';
    label: string;
    start: UnitAddress;
    end: UnitAddress;
    position: number;
}

/**
 * collection of cells, basically a wrapper around an
 * array, with some accessor and control methods.
 */
export declare class Cells {

    /** switching to row-major */
    data: Cell[][];
    get rows(): number;
    get columns(): number;

    /**
     * the sheet wants to make sure this row exists, probably because it has
     * a header. so we will update our dimensions to match. we don't actually
     * add data.
     *
     * this is not serialized. specific headers aren't serialized either, at
     * the moment, so it's sort of irrelevant. if we start serializing headers,
     * the deserialization routine can call this function to pad out, so we
     * don't need to store it here.
     */
    EnsureRow(row: number): void;

    /** @see EnsureRow */
    EnsureColumn(column: number): void;

    /**
     * this class does none of the validation/correction
     * required when inserting rows/columns. that should
     * be done by external logic. this method only does
     * the mechanical work of inserting rows/columns.
     */
    InsertColumns(before?: number, count?: number): void;
    DeleteColumns(index: number, count?: number): void;
    DeleteRows(index: number, count?: number): void;

    /**
     * this class does none of the validation/correction
     * required when inserting rows/columns. that should
     * be done by external logic. this method only does
     * the mechanical work of inserting rows/columns.
     */
    InsertRows(before?: number, count?: number): void;

    /**
     * return or create cell at the given address
     */
    GetCell(address: ICellAddress, create_new: true): Cell;

    /**
     * return the cell at the given address or undefined if it doesn't exist
     */
    GetCell(address: ICellAddress, create_new?: false): Cell | undefined;

    /**
     * apply function to range or address. skips empty cells (for now...)
     * (already have this function, it's called "IterateArea". "Apply" is better.)
     * /
    public Apply(target: ICellAddress|IArea, func: (cell: Cell) => void): void {
  
      if (IsCellAddress(target)) {
        target = new Area(target);
      }
  
      const start = target.start;
      const end = target.end;
  
      for (let r = start.row; r <= end.row; r++) {
        if (this.data[r]) {
          const row = this.data[r];
          for (let c = start.column; c < end.column; c++) {
            if (this.data[r][c]) {
              func.call(undefined, row[c]);
            }
          }
        }
      }
  
    }
    */

    /** returns an existing cell or creates a new cell. */
    EnsureCell(address: ICellAddress): Cell;

    /**
     * with the update, we assume the passed-in data is row-major.
     * when reading an older file, transpose.
     */
    FromArray(data?: CellValue[][], transpose?: boolean): void;

    /**
     * UPDATE: adding optional style refs, for export
     */
    FromJSON(data?: SerializedCellData, style_refs?: Style.Properties[]): void;
    toJSON(options?: CellSerializationOptions): {
        data: SerializedCellData;
        rows: number;
        columns: number;
    };
    GetAll(transpose?: boolean): CellValue | (string | number | boolean | Complex | undefined)[][];

    /** simply cannot make this work with overloads (prove me wrong) */
    Normalize2(from: ICellAddress, to: ICellAddress): {
        from: ICellAddress;
        to: ICellAddress;
    };

    /** simply cannot make this work with overloads (prove me wrong) */
    Normalize1(from: ICellAddress): ICellAddress;

    /**
     * get raw values (i.e. not calculated). anything outside of actual
     * range will be undefined OR not populated.
     *
     * to match GetRange, we return a single value in the case of a single cell,
     * or a matrix.
     *
     * NOTE that I'm not sure this is good behavior. if you're going to
     * return a single value for one cell, you should return a vector for
     * a single row OR a single column. alternatively, you should always
     * return a matrix.
     *
     * @param from
     * @param to
     * @param transpose
     */
    RawValue(from: ICellAddress, to?: ICellAddress): CellValue | CellValue[][] | undefined;

    /** gets range as values */
    GetRange(from: ICellAddress, to?: ICellAddress, transpose?: boolean): CellValue | (string | number | boolean | Complex | undefined)[][];
    GetRange4(from: ICellAddress, to?: ICellAddress, transpose?: boolean): UnionValue;

    /**
     * apply function to address/area
     */
    Apply(area: Area | ICellAddress, f: (cell: Cell, c?: number, r?: number) => void, create_missing_cells?: boolean): void;

    /**
     * set area. shortcut to reduce overhead. consolidates single value
     * and array value methods, although the implementation is separate.
     *
     * watch out for typed arrays, which do not satisfy Array.isArray
     *
     * when would this function get a 1D typed array? can't figure that out.
     * might have something to do with simulation data, but not sure.
     *
     * just drop for the time being.
     *
     */
    SetArea(area: Area, values: CellValue | CellValue[][]): void;

    /**
     * iterates over all cells (using loops) and runs function per-cell.
     * FIXME: switch to indexing on empty indexes? (...)
     */
    IterateAll(func: (cell: Cell) => void): void;

    /** moved from sheet, so we can do it non-functional style (for perf) */
    FlushCellStyles(): void;

    /** moved from sheet, so we can do it non-functional style (for perf) */
    FlushCachedValues(): void;
}
export interface CellSerializationOptions {
    preserve_type?: boolean;
    convert_address?: boolean;
    calculated_value?: boolean;
    expand_arrays?: boolean;
    subset?: Area;
    preserve_empty_strings?: boolean;
    decorated_cells?: boolean;

    /**
     * nest rows in columns, or vice-versa, depending on which is smaller.
     */
    nested?: boolean;

    /**
     * cell style refs to pack into cells
     */
    cell_style_refs?: number[][];

    /** optionally attach an ID to the cells */
    sheet_id?: number;
}
export interface BaseCellData {
    value: CellValue;
    style_ref?: number;
    calculated?: CellValue;
    area?: IArea;
    merge_area?: IArea;
    validation?: DataValidation;
    calculated_type?: ValueType;
    note?: string;
    hyperlink?: string;
    type?: ValueType;
    sheet_id?: number;
}
export interface FlatCellData extends BaseCellData {
    row: number;
    column: number;
}
export interface NestedCellData {
    cells: BaseCellData[];
}
export interface NestedRowData extends NestedCellData {
    row: number;
    cells: Array<{
        column: number;
    } & BaseCellData>;
}
export interface NestedColumnData extends NestedCellData {
    column: number;
    cells: Array<{
        row: number;
    } & BaseCellData>;
}
export declare type SerializedCellData = FlatCellData[] | NestedRowData[] | NestedColumnData[];

/**
 * FIXME: this should move out of the grid module, grid should be focused on view
 */
export interface DataModel {

    /** document metadata */
    document_name?: string;

    /** document metadata */
    user_data?: any;

    /** reference */
    active_sheet: Sheet;

    /**
     * list of sheets. we _should_ index these by ID, so we
     * don't have to look up. FIXME/TODO
     */
    sheets: Sheet[];

    /** named ranges are document-scope, we don't support sheet-scope names */
    named_ranges: NamedRangeCollection;

    /** macro functions are functions written in spreadsheet language */
    macro_functions: MacroFunctionMap;
}
export interface MacroFunction {
    name: string;
    function_def: string;
    argument_names?: string[];
    description?: string;
    expression?: ExpressionUnit;
}
export interface MacroFunctionMap {
    [index: string]: MacroFunction;
}
export declare class Sheet {
    static base_id: number;
    static readonly default_sheet_name = "Sheet1";

    /**
     * adding verbose flag so we can figure out who is publishing
     * (and stop -- part of the ExecCommand switchover)
     */

    /**
     * in the old model, we had a concept of "default" style properties. we then
     * used that object for theming: we would set default properties when the theme
     * changed.
     *
     * the problem is that if there are multiple instances on a single page, with
     * different themes, they would clash.
     *
     * so the new concept is to have a default property set per instance, managed
     * by the grid instance. any sheets that are loaded in/created by grid will
     * get a reference to that property set, and grid can update it as desired.
     *
     * because it's a reference, it should be constant.
     * FIXME: move to model...
     */
    readonly default_style_properties: Style.Properties;
    annotations: Annotation[];
    freeze: FreezePane;

    /** testing */
    visible: boolean;

    /** standard width (FIXME: static?) */
    default_column_width: number;

    /** standard height (FIXME: static?) */
    default_row_height: number;

    /** cells data */
    readonly cells: Cells;

    /**
     * selection. moved to sheet to preserve selections in multiple sheets.
     * this instance should just be used to populate the actual selection,
     * not used as a reference.
     */
    selection: GridSelection;

    /**
     * cache scroll offset for flipping between sheets. should this be
     * persisted? (...)
     */
    scroll_offset: ScrollOffset;

    /**
     * named ranges: name -> area
     * FIXME: this needs to move to an outer container, otherwise we
     * may get conflicts w/ multiple sheets. unless we want to allow that...
     */
    name: string;
    get header_offset(): {
        x: number;
        y: number;
    };

    /** accessor: now just a wrapper for the call on cells */
    get rows(): number;

    /** accessor: now just a wrapper for the call on cells */
    get columns(): number;
    get id(): number;
    set id(id: number);
    static Reset(): void;

    /**
     * factory method creates a new sheet
     */
    static Blank(style_defaults: Style.Properties, name?: string, rows?: number, columns?: number): Sheet;

    /**
     * deserialize json representation. returns new instance or updates
     * passed instance.
     *
     * FIXME: why not make this an instance method, always call on new instance?
     *
     * @param hints UpdateHints supports partial deserialization/replacement
     * if we know there are only minor changes (as part of undo/redo, probably)
     */
    static FromJSON(json: string | Partial<SerializedSheet>, style_defaults: Style.Properties, sheet?: Sheet): Sheet;
    MergeCells(area: Area): void;
    UnmergeCells(area: Area): void;

    /**
     * FIXME: measure the font.
     *
     * Can we use the same metrics as renderer? That uses a canvas. Obviously
     * canvas won't work if there's no DOM but it's OK if this method fails in
     * that case; the only question is will it break if it's running headless?
     */
    StyleFontSize(style: Style.Properties, default_properties?: Style.Properties): number;

    /**
     * FIXME: this is called in the ctor, which made sense when sheets
     * were more ephemeral. now that we update a single instance, rather
     * than create new instances, we lose this behavior. we should call
     * this when we change sheet style.
     *
     * removing parameter, event
     */
    UpdateDefaultRowHeight(): void;

    /**
     * deprecated (or give me a reason to keep it)
     * KEEP IT: just maintain flexibility, it has very low cost
     */
    SetRowHeaders(headers: CellValue[]): void;

    /**
     * deprecated (or give me a reason to keep it)
     * KEEP IT: just maintain flexibility, it has very low cost
     */
    SetColumnHeaders(headers: CellValue[]): void;

    /**
     * deprecated
     * KEEP IT: just maintain flexibility, it has very low cost
     */
    RowHeader(row: number): string | number;

    /**
     * deprecated
     * KEEP IT: just maintain flexibility, it has very low cost
     * (we did drop the multiple rows, though)
     */
    ColumnHeader(column: number): string;
    GetRowHeight(row: number): number;
    SetRowHeight(row: number, height: number): number;
    GetColumnWidth(column: number): number;
    SetColumnWidth(column: number, width: number): number;

    /**
     * returns set of properties in B that differ from A. returns
     * property values from B.
     *
     * this is the function I could never get to work inline for
     * Style.Properties -- not sure why it works better with a generic
     * function (although the partial here is new, so maybe it's that?)
     *
     * seems to be related to
     * https://github.com/microsoft/TypeScript/pull/30769
     *
     */
    Delta<T>(A: T, B: T): Partial<T>;

    /**
     * updates cell styles. flushes cached style.
     *
     * @param delta merge with existing properties (we will win conflicts)
     * @param inline this is part of another operation, don't do any undo/state updates
     */
    UpdateCellStyle(address: ICellAddress, properties: Style.Properties, delta?: boolean): void;

    /**
     * invalidate sets the "render dirty" flag on cells, whether there
     * is any change or not. we are currently using it to force rendering
     * when border/background changes, and we need to handle bleed into
     * neighboring cells.
     */
    Invalidate(area: Area): void;

    /**
     *
     * @param area
     * @param style
     * @param delta
     * @param render LEGACY PARAMETER NOT USED
     */
    UpdateAreaStyle(area?: Area, style?: Style.Properties, delta?: boolean): void;

    /**
     * checks if the given cell has been assigned a specific style, either for
     * the cell itself, or for row and column.
     */
    HasCellStyle(address: ICellAddress): boolean;

    /**
     * returns the next non-hidden column. so if you are column C (2) and columns
     * D, E, and F are hidden, then it will return 6 (G).
     */
    NextVisibleColumn(column: number): number;

    /**
     * @see NextVisibleColumn
     * because this one goes left, it may return -1 meaning you are at the left edge
     */
    PreviousVisibleColumn(column: number): number;

    /**
     * @see NextVisibleColumn
     */
    NextVisibleRow(row: number): number;

    /**
     * @see PreviousVisibleColumn
     */
    PreviousVisibleRow(row: number): number;

    /**
     * returns style properties for cells surrounding this cell,
     * mapped like a number pad:
     *
     * +---+---+---+
     * | 7 | 8 | 9 |
     * +---+---+---+
     * | 4 | X | 6 |
     * +---+---+---+
     * | 1 | 2 | 3 |
     * +---+---+---+
     *
     * presuming you already have X (5). this is called by renderer, we
     * move it here so we can inline the next/previous loops.
     *
     */
    SurroundingStyle(address: ICellAddress): Style.Properties[];

    /**
     * get style only. as noted in the comment to `CellData` there used to be
     * no case where this was useful without calculated value as well; but we
     * now have a case: fixing borders by checking neighboring cells. (testing).
     *
     * switching from null to undefined as "missing" type
     */
    CellStyleData(address: ICellAddress): Style.Properties | undefined;

    /**
     * accessor to get cell style without row pattern -- for cut/copy
     * @param address
     */
    GetCopyStyle(address: ICellAddress): Style.Properties;

    /**
     * wrapper for getting all relevant render data.
     * TODO: merge in "FormattedValue". restructure data so we don't have
     * two caches (formatted and calculated).
     *
     * NOTE: we removed "GetCellStyle" in favor of this function. the rationale
     * is that there are no reasonable cases where someone looks up the style
     * without that being a next step to (or in reasonable proximity to)
     * rendering. so it's reasonable to call this function even if it's in
     * advance of rendering.
     *
     * NOTE: that applies to the "GetCellFormula" and "GetCellValue" functions
     * as well -- so remove those too.
     *
     * NOTE: actually GetCellFormula resolves array formulae, so maybe not --
     * or the caller needs to check.
     *
     */
    CellData(address: ICellAddress): Cell;

    /**
     * format number using passed format; gets the actual format object
     * and calls method. returns a string or array of text parts
     * (@see treb-format).
     */
    FormatNumber(value: CellValue, format?: string): string | TextPart[];

    /**
     * the only place this is called is in a method that shows/hides headers;
     * it sets the size either to 1 (hidden) or undefined, which uses the
     * defaults here. that suggests we should have a show/hide method instead.
     *
     * @param row_header_width
     * @param column_header_height
     */
    SetHeaderSize(row_header_width?: number, column_header_height?: number): void;

    /**
     * resize row to match character hight, taking into
     * account multi-line values.
     *
     * UPDATE: since the only caller calls with inline = true, removing
     * parameter, test, and extra behavior.
     */
    AutoSizeRow(row: number, default_properties?: Style.Properties, allow_shrink?: boolean): void;

    /**
     * auto-sizes the column, but if the allow_shrink parameter is not set
     * it will only enlarge, never shrink the column.
     *
     * UPDATE: since the only caller calls with inline = true, removing
     * parameter, test, and extra behavior.
     */
    AutoSizeColumn(column: number, allow_shrink?: boolean): void;

    /** returns the style properties for a given style index */
    GetStyle(index: number): Style.Properties;

    /**
     *
     * @param before_row insert before
     * @param count number to insert
     */
    InsertRows(before_row?: number, count?: number): boolean;

    /**
     * see InsertRow for details
     */
    InsertColumns(before_column?: number, count?: number): boolean;

    /** clear cells in area */
    ClearArea(area: Area): void;
    SetAreaValues2(area: Area, values: CellValue | CellValue[][]): void;

    /**
     * set the area as an array formula, based in the top-left cell
     */
    SetArrayValue(area: Area, value: CellValue): void;

    /**
     * set a single value in a single cell
     */
    SetCellValue(address: ICellAddress, value: CellValue): void;

    /**
     * returns the area bounding actual content
     * (i.e. flattening "entire row/column/sheet")
     *
     * FIXME: this does not clamp to actual cells... why not?
     * FIXME: so now we are (optionally) clamping end; should clamp start, too
     *
     * @param clamp -- new parameter will optionally clamp to actual sheet size
     */
    RealArea(area: Area, clamp?: boolean): Area;
    FormattedCellValue(address: ICellAddress): CellValue;
    GetFormattedRange(from: ICellAddress, to?: ICellAddress): CellValue | CellValue[][];

    /**
     * get all styles used in the sheet. this is used to populate color
     * and number format lists in the toolbar. we used to just serialize
     * the document and use that, but that's absurdly wasteful. for this
     * application we don't even need composites.
     *
     * although, this is a bit dangerous because you could (in theory)
     * modify the results in place. so maybe we should either duplicate or
     * just return the requested data...
     */
    NumberFormatsAndColors(color_map: Record<string, number>, number_format_map: Record<string, number>): void;

    /**
     * generates serializable object. given the new data semantics this
     * has to change a bit. here is what we are storing:
     *
     * all style data (sheet, row/column, alternate and cell)
     * raw value for cell
     * array head for arrays
     * row height and column width arrays
     *
     * because we have sparse arrays, we convert them to flat objects first.
     */
    toJSON(options?: SerializeOptions): SerializedSheet;

    /** flushes ALL rendered styles and caches. made public for theme API */
    FlushCellStyles(): void;
    ImportData(data: ImportedSheetData): void;
}

/**
 * this is moved from export to avoid a circular reference
 */
export interface ImportedSheetData {
    name: string | undefined;
    cells: CellParseResult[];
    default_column_width: number;
    column_widths: number[];
    row_heights: number[];
    styles: Style.Properties[];
    sheet_style?: number;
    column_styles?: number[];
    annotations?: AnchoredAnnotation[];
    hidden?: boolean;
}
export interface CellParseResult {
    row: number;
    column: number;
    type: ValueType;
    value: number | string | undefined | boolean;
    calculated?: number | string | undefined | boolean;
    calculated_type?: ValueType;
    style_ref?: number;
    hyperlink?: string;
    validation?: DataValidation;
    merge_area?: IArea;
    area?: IArea;
}
export interface AnchoredAnnotation {
    layout: AnnotationLayout;
    type?: string;
    formula?: string;
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
export declare class Annotation {
    get key(): number;

    /** coordinates, in sheet space */
    rect?: Rectangle;

    /** display coordinates, possibly scaled. not persisted. */
    scaled_rect?: Rectangle;

    /** the new layout, persisted and takes preference over the old one */
    layout?: AnnotationLayout;

    /** opaque data. this is serialized, so it's persistent data */
    data: any;

    /** type, for filtering. ensure a value */
    type: string;

    /** also opaque data, but not serialized. */
    temp: any;

    /** flag indicating we have inflated this. not serialized */
    inflated: boolean;

    /** if function exists, will be called when the annotation is resized */
    resize_callback?: () => void;

    /** if function exists, will be called when the annotation needs to update */
    update_callback?: () => void;

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

    /** layout node, obviously not serialized */
    node?: HTMLDivElement;

    /** content node */
    content_node?: HTMLDivElement;

    /**
     * advisory, meaning we probably need an update if there's an opportunity.
     * only advisory and not persisted.
     */
    dirty?: boolean;

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
    extent?: ICellAddress;

    /**
     * constructor takes a property bag (from json, generally). note that
     * if you are iterating keys on `this`, there has to be an initial value
     * or the key won't exist.
     */
    constructor(opts?: Partial<Annotation> & {
        rect?: Partial<Rectangle>;
    });

    /**
     * serialization method drops node and trims
     */
    toJSON(): Partial<Annotation>;
}
export declare class Rectangle implements IRectangle {
    left: number;
    top: number;
    width: number;
    height: number;
    get right(): number;
    get bottom(): number;

    /**
     * create a rectangle from an object that looks
     * like a rectangle, probably a serialized object
     */
    static Create(obj: Partial<Rectangle>): Rectangle;
    static IsRectangle(obj: unknown): obj is IRectangle;
    constructor(left?: number, top?: number, width?: number, height?: number);

    /** returns a new rect shifted from this one by (x,y) */
    Shift(x?: number, y?: number): Rectangle;
    Scale(scale_x?: number, scale_y?: number): Rectangle;

    /** returns a new rect expanded from this one by (x,y) */
    Expand(x?: number, y?: number): Rectangle;

    /** returns a new rectangle that combines this rectangle with the argument */
    Combine(rect: Rectangle): Rectangle;
    CheckEdges(x: number, y: number, border?: number): number;

    /**
     * check if rectangle contains the given coordinates, optionally with
     * some added padding
     */
    Contains(x: number, y: number, padding?: number): boolean;

    /** convenience method for canvas */
    ContextFill(context: CanvasRenderingContext2D): void;

    /** convenience method for canvas */
    ContextStroke(context: CanvasRenderingContext2D): void;

    /** clamp coordinate to rectangle */
    Clamp(x: number, y: number): {
        x: number;
        y: number;
    };

    /** convenience method for html element style */
    ApplyStyle(element: HTMLElement): void;
    toJSON(): {
        top: number;
        left: number;
        width: number;
        height: number;
    };
}
export interface FreezePane {
    rows: number;
    columns: number;
}
export interface ScrollOffset {
    x: number;
    y: number;
}
export interface SerializedSheet {
    data: SerializedCellData;
    sheet_style: Style.Properties;
    rows: number;
    columns: number;
    cell_styles: Array<{
        row: number;
        column: number;
        ref: number;
    }>;

    /** @deprecated */
    cell_style_refs?: Style.Properties[];
    styles?: Style.Properties[];
    row_style: Record<number, Style.Properties | number>;
    column_style: Record<number, Style.Properties | number>;
    row_pattern?: Style.Properties[];
    default_row_height?: number;
    default_column_width?: number;
    row_height?: {
        [index: number]: number;
    };
    column_width?: {
        [index: number]: number;
    };
    named_ranges?: {
        [index: string]: IArea;
    };
    freeze?: FreezePane;
    id?: number;
    name?: string;
    selection: GridSelection;
    annotations?: Partial<Annotation>[];
    scroll?: ScrollOffset;
    visible?: boolean;
}

/**
 * FIXME: this is broken. we treat this as a simple javascript object,
 * cloning and creating via JSON, but area is a class instance.
 *
 * that means cloned objects won't work properly (if anyone is relying on
 * that object).
 */
export interface GridSelection {

    /** target or main cell in the selection */
    target: ICellAddress;

    /** selection area */
    area: Area;

    /** there is nothing selected, even though this object exists */
    empty?: boolean;

    /** for cacheing addtional selections. optimally don't serialize */
    rendered?: boolean;
}
export declare class NamedRangeCollection {

    /** FIXME: why not an accessor? */
    Count(): number;

    /** FIXME: why not just use toJSON? */
    Serialize(): any;
    Deserialize(data?: {
        [index: string]: IArea;
    }): void;

    /**
     * match an area, optionally a target within a larger area (for selections).
     * we don't use the selection directly, as we may need to adjust target for
     * merge area.
     */
    MatchSelection(area: Area, target?: Area): string | undefined;

    /**
     * add name. names are case-insensitive. if the name already
     * exists, it will be overwritten.
     *
     * update: returns success (FIXME: proper errors)
     */
    SetName(name: string, range: Area, apply?: boolean): boolean;
    SetNames(list: {
        [index: string]: IArea;
    }): void;
    ClearName(name: string, apply?: boolean): void;
    Reset(): void;
    Get(name: string): Area;

    /** FIXME: accessor */
    Map(): {
        [index: string]: Area;
    };

    /** FIXME: accessor */
    List(): {
        name: string;
        range: Area;
    }[];

    /**
     * named range rules:
     *
     * - legal characters are alphanumeric, underscore and dot.
     * - must start with letter or underscore (not a number or dot).
     * - cannot look like a spreadsheet address, which is 1-3 letters followed by numbers.
     *
     * returns a normalized name (just caps, atm)
     */
    ValidateNamed(name: string): string | false;

    /**
     * fix named range references after row/column insert/delete
     */
    PatchNamedRanges(before_column: number, column_count: number, before_row: number, row_count: number): void;
    RebuildList(): void;
}

/**
 * second specialization of vertex: this class is for non-cell elements
 * that are dependent on cells: specifically, charts.
 *
 * we want leaf vertices to participate in the normal dirty/calculate
 * cycle, but they don't need to do any calculation other than checking
 * if the underlying data has changed. we should maintain some state so
 * this is a simple check for observers.
 *
 * leaves specifically do not have addresses. we can represent the chart
 * as a calculation, however. (...)
 *
 * FIXME: it might be better to have an intermediate class/interface and
 * have both leaf- and spreadsheet-vertex extend that.
 *
 */
export declare class LeafVertex extends SpreadsheetVertex {
    static type: string;
    state_id: number;
    type: string;

    /**
     * leaf vertex defaults to black (i.e. tested) because leaf nodes cannot have
     * outbound edges. it is still possible to change this, because it's a property
     * and we can't override the set accessor, but making it an accessor in the
     * superclass just for this purpose is not worthwhile since regular vertices
     * should vastly outnumber leaves.
     */
    color: Color;

    /**
     * construct the state, compare, and increment the state id if
     * it changes. this is expected to be called from Calculate(), but
     * we can also call it on init if we already know the state.
     *
     * FIXME: what's more expensive, generating this state field or
     * re-rendering a chart with the same data? (...?)
     * especially since it's only called on dirty...
     *
     * what is the case where the depenendency is dirty but state
     * does not change? you type in the same value? (...) or maybe
     * there's a volatile function that doesn't change value (e.g. Today())
     *
     * still, it seems like a waste here. let's test without the state.
     * (meaning just update the flag anytime it's dirty)
     *
     * Actually I think the case is manual recalc, when values don't change
     * (especially true for MC charts).
     *
     * TODO: perf
     */
    UpdateState(): void;

    /** overrides calculate function */
    Calculate(graph: GraphCallbacks): void;
    AddDependent(edge: Vertex): void;
}

/**
 * parser for spreadsheet language.
 *
 * FIXME: this is stateless, think about exporting a singleton.
 *
 * (there is internal state, but it's only used during a Parse() call,
 * which runs synchronously). one benefit of using a singleton would be
 * consistency in decimal mark, we'd only have to set once.
 *
 * FIXME: split rendering into a separate class? would be a little cleaner.
 */
export declare class Parser {

    /**
     * argument separator. this can be changed prior to parsing/rendering.
     * FIXME: use an accessor to ensure type, outside of ts?
     */
    argument_separator: ArgumentSeparatorType;

    /**
     * decimal mark. this can be changed prior to parsing/rendering.
     * FIXME: use an accessor to ensure type, outside of ts?
     */
    decimal_mark: DecimalMarkType;

    /**
     * recursive tree walk.
     *
     * @param func function called on each node. for nodes that have children
     * (operations, calls, groups) return false to skip the subtree, or true to
     * traverse.
     */
    Walk(unit: ExpressionUnit, func: (unit: ExpressionUnit) => boolean): void;

    /** utility: transpose array */
    Transpose(arr: Array<Array<string | boolean | number | undefined>>): Array<Array<string | boolean | number | undefined>>;

    /**
     * renders the passed expression as a string.
     * @param unit base expression
     * @param offset offset for addresses, used to offset relative addresses
     * (and ranges). this is for copy-and-paste or move operations.
     * @param missing string to represent missing values (can be '', for functions)
     */
    Render(unit: ExpressionUnit, offset?: {
        rows: number;
        columns: number;
    }, missing?: string, convert_decimal?: DecimalMarkType, convert_argument_separator?: ArgumentSeparatorType, convert_imaginary_number?: 'i' | 'j'): string;

    /**
     * parses expression and returns the root of the parse tree, plus a
     * list of dependencies (addresses and ranges) found in the expression.
     *
     * NOTE that in the new address parsing structure, we will overlap ranges
     * and addresses (range corners). this is OK because ranges are mapped
     * to individual address dependencies. it's just sloppy (FIXME: refcount?)
     */
    Parse(expression: string): ParseResult;
}

/**
 * argument separator type for i18n
 */
export declare enum ArgumentSeparatorType {
    Comma = ",",
    Semicolon = ";"
}

/**
 * decimal mark for i18n
 */
export declare enum DecimalMarkType {
    Period = ".",
    Comma = ","
}

/**
 * compound result of a parse operation includes dependency list
 * and an error flag (inverted)
 */
export interface ParseResult {
    expression?: ExpressionUnit;
    valid: boolean;
    error_position?: number;
    error?: string;
    dependencies: DependencyList;
    separator?: string;
    decimal_mark?: string;
    full_reference_list?: Array<UnitRange | UnitAddress | UnitIdentifier>;
}

/** list of addresses and ranges in the formula, for graphs */
export interface DependencyList {
    addresses: {
        [index: string]: UnitAddress;
    };
    ranges: {
        [index: string]: UnitRange;
    };
}
export interface FunctionMap {
    [index: string]: CompositeFunctionDescriptor;
}

/**
 * the stored value also includes a canonical name. this used to be separate
 * from the registered name (because those were functions, and had to adhere
 * to language rules) but now we use arbitrary tokens, so we can consolidate.
 */
export interface ExtendedFunctionDescriptor extends CompositeFunctionDescriptor {
    canonical_name: string;
}
export declare enum ReturnType {
    value = 0,
    reference = 1
}

/**
 * this is the data side of autocomplete (maintaining the list, matching).
 * we add this to grid because grid controls the editors; clients can pass
 * in lists.
 *
 * TODO: structure
 * TODO: other symbols... [FIXME: defined names need to go in here]
 * TODO: context -- cell vs annotation (...)
 *
 * FIXME: why does this use different definitions than the functions?
 * can't we merge the two?
 *
 * [I think they may have been developed independently and them converged...]
 *
 */
export interface ArgumentDescriptor {
    name?: string;
}

/**
 * merging the old function descriptor and decorated function types, since
 * there's a good deal of overlap and we spend a lot of effort keeping them
 * in sync.
 *
 * this is a wrapper object that contains the function and (mostly optional)
 * metadata.
 */
export interface CompositeFunctionDescriptor {

    /**
     * description for the function wizard
     */
    description?: string;

    /**
     * list of arguments, for the function wizard and tooltip
     */
    arguments?: ArgumentDescriptor[];

    /**
     * volatile: value changes on every recalc, even if dependencies
     * don't change
     */
    volatile?: boolean;

    /**
     * volatile during a simulation only
     * FIXME: MC calculator only
     */

    /**
     * FIXME: we need to unify type with what's in the cell class
     */
    render?: RenderFunction;
    click?: ClickFunction;

    /**
     * the actual function. if this is an object member and needs access
     * to the containing instance, make sure to bind it to that instance.
     */
    fn: (...args: any[]) => UnionValue;

    /**
     * for the future. some functions should not be available in
     * spreadsheet cells (charts, basically)
     */
    visibility?: string;

    /**
     * for the future
     */
    category?: string[];
    extension?: boolean;

    /**
     * there is some set of functions that need an "_xlfn." prefix on export.
     * I'm not sure why or where the list comes from, but we want to flag
     * those functions so we can export them properly.
     */
    xlfn?: boolean;

    /**
     * support returning references
     */
    return_type?: ReturnType;
}
export interface FunctionDescriptor {
    name: string;
    description?: string;
    arguments?: ArgumentDescriptor[];
    type?: DescriptorType;
}
export declare enum DescriptorType {
    Function = 0,
    Token = 1
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
 * options for creating spreadsheet
 */
export interface EmbeddedSpreadsheetOptions {

    /** containing HTML element */
    container?: string | HTMLElement;

    /** allow drag-and-drop files */
    dnd?: boolean;

    /** expandable grid */
    expand?: boolean;

    /** key in localStorage for persisting document */
    storage_key?: string;

    /** don't load immediately (?) */
    toll_initial_load?: boolean;

    /** show formula bar */
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

    /** fill container */
    auto_size?: boolean;

    /** popout icon */
    popout?: boolean;

    /** fetch network document (URI) */
    network_document?: string;

    /** load this document if the storage document isn't found (fallback) */
    alternate_document?: string;

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
     * toolbar display option
     */
    toolbar?: boolean | 'show' | 'narrow' | 'show-narrow';

    /** file options in the toolbar */
    file_menu?: boolean;

    /** font size in the toolbar */
    font_scale?: boolean;

    /** chart menu in the toolbar */
    chart_menu?: boolean;

    /** recalculate button in the toolbar */
    toolbar_recalculate_button?: boolean;

    /** new option, better support for headless operations (default false) */
    headless?: boolean;

    /** max size for image, in bytes */
    max_file_size?: number;

    /** initial scale */
    scale?: number;

    /** show scale buttons */
    scale_control?: boolean;

    /** save/load scale. this can optionally have a string key to disambiguate */
    persist_scale?: boolean | string;

    /** target window for hyperlinks (default _blank); set false to disable hyperlinks altogether */
    hyperlinks?: string | false;

    /**
     * for rendering the imaginary number. this is intended to support
     * switching to a different character for rendering, or adding a leading
     * space/half-space/hair-space.
     */
    imaginary_value?: string;

    /** support MD formatting for text */
    markdown?: boolean;

    /** show tinted colors in toolbar color dropdowns */
    tint_theme_colors?: boolean;
}
export declare enum LoadSource {
    DRAG_AND_DROP = "drag-and-drop",
    LOCAL_FILE = "local-file",
    NETWORK_FILE = "network-file",
    LOCAL_STORAGE = "local-storage",
    UNDO = "undo"
}

/**
 * EmbeddedSheetEvent is a discriminated union. Switch on the `type` field
 * of the event.
 */
export declare type EmbeddedSheetEvent = DocumentChangeEvent | DocumentResetEvent | DocumentLoadEvent | DataChangeEvent | SelectionEvent | ResizeEvent;
export interface ResizeEvent {
    type: 'resize';
}
export declare enum LoadType {
    TREB = "treb",
    CSV = "csv",
    XLSX = "xlsx"
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
 *
 * @deprecated we should remove this in favor of the Load event, plus a suitable load source.
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
