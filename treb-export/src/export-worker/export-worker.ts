/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { ImportedSheetData } from 'treb-base-types/src';

import { Exporter } from '../export2';
import { Importer } from '../import2';

const ctx: Worker = self as any;
const exporter = new Exporter();

const ExportSheets = async (data: any) => {

  if (data.sheet) {
    await exporter.Init(data.decorated || []);
    await exporter.Export(data.sheet);

    const blob = await exporter.AsBlob(1);
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
