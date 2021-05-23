

// import { Importer } from '../import';
// import { Exporter } from '../export';
import { ImportedSheetData, IArea } from 'treb-base-types/src';

import { Exporter } from '../export2';
import { Importer } from '../import2';

const ctx: Worker = self as any;
const exporter = new Exporter();

const ExportSheets = async (data: any) => {

  if (data.sheet) {
    await exporter.Init();
    await exporter.Export(data.sheet);

    const blob = await exporter.AsBlob(1);
    const corrected = (blob as Blob).slice(0, (blob as Blob).size,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    ctx.postMessage({ status: 'complete', blob: corrected });
  }

  /*
  if (data.sheet) {
    await exporter.Init();
    await exporter.ExportSheets(data.sheet);
    const blob = await exporter.AsBlob(1);

    // correct the mime type for firefox
    const corrected = (blob as Blob).slice(0, (blob as Blob).size,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    ctx.postMessage({ status: 'complete', blob: corrected });
  }
  */
};

const ImportSheet = async (data: any) => {

  const importer = new Importer();

  try {
    await importer.Init(data.data);

    const count = importer.SheetCount();
    const results = {
      sheets: [] as ImportedSheetData[],
      names: importer.workbook?.GetNamedRanges(),
      active_tab: importer.workbook?.active_tab,
    };

    for (let i = 0; i < count; i++) {
      const result = await importer.GetSheet(i);
      if (result) {
        results.sheets.push(result);
      }
    }
    ctx.postMessage({ status: 'complete', results });

  }
  catch (err) {
    console.warn('error importing xlsx file');
    console.info(err);
    ctx.postMessage({ status: 'error', data: err });
  }

};

// initialize message handler
ctx.addEventListener('message', (event) => {
  if (event.data && event.data.command === 'export'){
    ExportSheets(event.data);
  }
  else if (event.data && event.data.command === 'import'){
    ImportSheet(event.data);
  }
});
