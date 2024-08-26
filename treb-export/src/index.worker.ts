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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { ImportedSheetData } from 'treb-base-types';
import type { SerializedModel } from 'treb-data-model';

import { Exporter } from './export';
import { Importer } from './import';

const ctx: Worker = self as unknown as Worker;
const exporter = new Exporter();

const ExportSheets = (data: {
  sheet: SerializedModel,
  decorated: Record<string, string>,
}) => {

  if (data.sheet) {
    exporter.Init(data.decorated || []);
    exporter.Export(data.sheet);
    ctx.postMessage({ status: 'complete', blob: exporter.Blob() });
  }

};

const ImportSheet = (data: { data: ArrayBuffer }) => {

  const importer = new Importer();

  try {
    importer.Init(data.data);

    const named = importer.workbook?.GetNamedRanges();

    const count = importer.SheetCount();
    const results = {
      sheets: [] as ImportedSheetData[],
      named,
      active_tab: importer.workbook?.active_tab,
    };

    for (let i = 0; i < count; i++) {
      const result = importer.GetSheet(i);
      if (result) {
        results.sheets.push(result);
      }
    }

    for (const entry of named || []) {
      if (typeof entry.local_scope === 'number') {
        const sheet = results.sheets[entry.local_scope];
        if (sheet) {
          entry.scope = sheet.name;
        }
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
    ExportSheets(event.data as { sheet: SerializedModel, decorated: Record<string, string>});
  }
  else if (event.data && event.data.command === 'import'){
    ImportSheet(event.data as { data: ArrayBuffer });
  }
});
