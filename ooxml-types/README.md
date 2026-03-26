# ooxml-types


> NOTE: this is the original readme from the OOXML types project, when it
> was its own repository. It's now merged into the main TREB code tree.

---

TypeScript types describing parsed OOXML spreadsheet objects. These types model the JS objects produced by an XML parser reading `.xlsx` files — not the raw XML itself.

## Parser assumptions

The XML parser converts XLSX XML into JS objects with these conventions:

- Each XML element becomes an object, with child elements as properties named by their tag name
- `$attributes` holds the element's XML attributes as an object
- `$text` holds the element's text content
- A single child element is stored as an object directly; multiple children with the same tag become an array
- Attribute values are coerced to JS types (numbers, booleans)
- Namespace prefixes on attributes are dropped (`r:id` → `id`)

## Reference parser

To generate the expected type layout using `fast-xml-parser`:

```ts

import { XMLParser, type X2jOptions } from 'fast-xml-parser';

const options: X2jOptions = {
  attributesGroupName: '$attributes',
  ignoreAttributes: false,
  parseAttributeValue: true,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  textNodeName: '$text',
  cdataPropName: '$cdata',
  parseTagValue: false,
  alwaysCreateTextNode: true,
};

const parser = new XMLParser(options);

// read file and parse

```

## Type conventions

| Convention | Example |
|---|---|
| Type names are PascalCase | `Worksheet`, `Row`, `Cell` |
| Property names match XML tag names exactly | `sheetData`, `c`, `f`, `v` |
| Enum types use OOXML spec names | `ST_CellType`, `ST_Orientation` |
| Single-or-array children use `OneOrMany<T>` | `T \| T[]` |
| `$attributes` is optional on every type | Parser omits it when an element has no attributes |
| Required attributes are required *inside* `$attributes` | `Col.$attributes.min` is required, but `Col.$attributes` itself is optional |
| Text-content elements use `TextElement` | `{ $text?: string }` |
| Unmodeled sub-trees are stubbed | `Record<string, unknown>` |

## Scope

### Package (`src/types/package/`)

- **Content types** (`[Content_Types].xml`) — `ContentTypes`, `Default`, `Override`, with `WellKnownContentType` for autocomplete
- **Relationships** (`*.rels`) — `Relationships`, `Relationship`, with `WellKnownRelationshipType` for autocomplete
- **Core properties** (`docProps/core.xml`) — title, creator, timestamps, keywords, etc. (Dublin Core)
- **Extended properties** (`docProps/app.xml`) — application, company, version, document statistics

### SpreadsheetML (`src/types/spreadsheetml/`)

**Workbook** (`xl/workbook.xml`):
- Sheets, defined names, calculation properties
- Book views, file version, workbook properties/protection
- Pivot caches, external references

**Worksheet** (`xl/worksheets/sheetN.xml`):
- Sheet data (rows, cells, formulas, inline strings)
- Sheet views (panes, selections, zoom)
- Column definitions
- Sheet properties, dimensions, format properties, protection
- Page layout (margins, setup, print options, header/footer, breaks)
- Merge cells, conditional formatting, data validations
- Auto filter, sort state, hyperlinks
- Drawing and table part references
- Sparklines (via worksheet-specific extension list)

**Shared strings** (`xl/sharedStrings.xml`):
- String items with plain text, rich text runs, phonetic runs

**Metadata** (`xl/metadata.xml`):
- Metadata types, cell/value metadata blocks
- Future metadata with dynamic array properties (via metadata-specific extension list)

**Styles** (`xl/styles.xml`):
- Number formats, fonts, fills (pattern + gradient), borders
- Cell formats (`xf`), cell styles, alignment, cell protection
- Differential formats (for conditional formatting)
- Table styles, color palettes (indexed + MRU)

**Comments** (`xl/comments1.xml`):
- Authors list, comment list with cell references
- Rich text comment bodies (reuses `RichTextRun`)

**Tables** (`xl/tables/tableN.xml`):
- Table columns with names, totals row functions, calculated column formulas
- Table style info, auto filter (reused from worksheet), table-level sort state

**Extension lists** are generic (`ExtensionList<E>`) with context-specific extension types (`WorksheetExtension`, `MetadataExtension`) so autocomplete only shows relevant children.

### DrawingML (`src/types/drawingml/`)

**Theme** (`xl/theme/theme1.xml`):
- Color scheme (12 named theme colors: dk1/lt1/dk2/lt2, accent1–6, hlink, folHlink)
- Font scheme (major/minor font collections with latin, EA, CS, and per-script supplemental fonts)
- Format scheme (stubbed — fill/line/effect style lists)

**Spreadsheet Drawing** (`xl/drawings/drawingN.xml`):
- Two-cell and one-cell anchors with column/row offset positioning
- Graphic frames linking to charts via relationship IDs
- Non-visual properties (id, name, description)
- Shape/picture/connector content (stubbed)

**Chart** (`xl/charts/chartN.xml`):
- Chart space root with date system, language, style
- Plot area with bar, line, pie, doughnut, area, scatter, radar chart types (3D variants stubbed)
- Series data with numeric/string references and caches
- Category, value, date, and series axes with scaling and positioning
- Legend, chart title, data labels
- Print settings (page margins, header/footer, page setup)

### Not yet covered

Pivot tables.

## Development

```sh
npm install
npm run typecheck   # runs tsc --noEmit
```
