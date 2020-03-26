
// import { Importer, Exporter } from '../';
import { Importer } from '../import';
import { Exporter } from '../export';

const ctx: Worker = self as any;
const exporter = new Exporter();

const ExportSheet = async (data: any) => {
  if (data.sheet) {
    await exporter.Init();
    await exporter.ExportSheet(data.sheet);
    const blob = await exporter.AsBlob(1);

    // correct the mime type for firefox
    const corrected = (blob as Blob).slice(0, (blob as Blob).size,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    ctx.postMessage({ status: 'complete', blob: corrected });
  }
};

const ImportSheet = async (data: any) => {

  const importer = new Importer();

  try {
    await importer.Init(data.data);

    const count = importer.SheetCount();
    const results = [];

    for (let i = 0; i < count; i++) {
      const result = await importer.GetSheet(i);
      results.push(result);
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
    ExportSheet(event.data);
  }
  else if (event.data && event.data.command === 'import'){
    ImportSheet(event.data);
  }
});
