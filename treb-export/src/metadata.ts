import { XMLUtils } from './xml-utils';

/**
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.metadatarecord?view=openxml-3.0.1
 * 
 * ah, mixing 0-based and 1-based indexes. that's great. not at all confusing.
 */
export interface MetadataRecord  {

  //
  // A 1-based index to the metadata record type in metadataTypes.
  //
  t: number;

  //
  // A zero based index to a specific metadata record. If the corresponding 
  // metadataType has name="XLMDX", then this is an index to a record in 
  // mdxMetadata, otherwise this is an index to a record in the futureMetadata 
  // section whose name matches the name of the metadataType.
  //
  v: number;

}

/** 
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.metadatatype?view=openxml-3.0.1
 * 
 * punting on all these attributes for now, except the ones we specifically 
 * want.
 */
export interface MetadataType {

  //
  // Represents the name of this particular metadata type. This name shall be 
  // unique amongst all other metadataTypes.
  //
  name: string;

  //
  // A Boolean flag indicating whether metadata is cell metadata. True when 
  // the metadata is cell metadata, false otherwise - in the false case it 
  // is considered to be value metadata.
  //
  cell_meta?: boolean;

}

/**
 * the type `Future Feature Data Storage Area` is not actually defined? not 
 * sure. maybe it's just a standard extension type and I need to look that up?
 * 
 * for the time being we'll use a list of flags...
 */
export interface MetadataFlags {
  'dynamic-array'?: boolean;
}

/**
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.futuremetadata?view=openxml-3.0.1
 * https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.futuremetadatablock?view=openxml-3.0.1
 * 
 * these are named, matching the names in "MetadataType"; we'll use those
 * as indexes, and not store them in the object.
 * 
 */
export interface FutureMetadata {
  flags: MetadataFlags;
}

/**
 * we're just reflecting the actual data at this point, not simplifying 
 * (although we should simplify). will require some lookups.
 */
export interface Metadata {
  cell_metadata: MetadataRecord[];
  metadata_types: MetadataType[];

  // TODO
  // value_metadata: MetadataRecord[];

  future_metadata: Record<string, FutureMetadata[]>;

}

export const LookupMetadata = (source: Metadata, type: 'cell'|'value', index: number): FutureMetadata => {

  if (type === 'cell') {

    //
    // the docs say "zero based", but this looks to be one based -- there's
    // only one entry when we create a doc, but the cm index in cells is "1".
    //
    // https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.cell?view=openxml-3.0.1&redirectedfrom=MSDN
    //

    const metadata_type = source.cell_metadata[index - 1];

    if (metadata_type) {
      const record_type = source.metadata_types[metadata_type.t - 1]; // 1-based
      if (record_type) {
        if (record_type.name === 'XLMDX') {
          // ...
        }
        else {
          const future_metadata_list = source.future_metadata[record_type.name];
          if (future_metadata_list) {
            return future_metadata_list[metadata_type.v] || {}; // 0-based
          }
        }
      }
    }
  }
  else {
    console.warn('value metadata not implemented')
  }

  return {flags: {}}; // null, essentially

};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ParseMetadataXML = (xml: any): Metadata => {

  const metadata: Metadata = {
    metadata_types: [],
    cell_metadata: [],
    future_metadata: {},
  };

  const metadata_types = XMLUtils.FindAll(xml, 'metadata/metadataTypes/metadataType');
  for (const entry of metadata_types) {

    const name: string = entry.a$?.name || '';
    const value = entry.a$?.cellMeta;
    const cell_meta: boolean = (value === '1' || value === 'true');

    metadata.metadata_types.push({ 
      name, cell_meta 
    });

  }

  const future_metadata_blocks = XMLUtils.FindAll(xml, 'metadata/futureMetadata');
  for (const entry of future_metadata_blocks) {

    const name: string = entry.a$?.name || '';
    if (name) {

      const future_metadata_list: FutureMetadata[] = [];

      // `extLst` entries can be inside of `bk` entries, but aparently not
      // required? what's the case where they are _not_ in `bk` elements?
      
      for (const block of XMLUtils.FindAll(entry, 'bk')) {

        const future_metadata: FutureMetadata = { flags: {} };

        // I guess metadata attributes are elements? we'll probably 
        // have to look them up individually

        for (const child of XMLUtils.FindAll(block, 'extLst/ext/xda:dynamicArrayProperties')) {
          if (child?.a$.fDynamic === '1') {
            future_metadata.flags['dynamic-array'] = true;
          }
        }

        future_metadata_list.push(future_metadata);

      }

      metadata.future_metadata[name] = future_metadata_list;

    }
  }

  for (const entry of XMLUtils.FindAll(xml, 'metadata/cellMetadata/bk/rc')) {
    metadata.cell_metadata.push({
      t: Number(entry.a$?.t || -1),
      v: Number(entry.a$?.v || -1),
    });
  }

  // console.info({metadata});

  return metadata;
    
}
