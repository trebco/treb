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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import type { ImportedSheetData } from 'treb-base-types';
import type { SerializedModel, SerializedNamed } from 'treb-data-model';

export type ExportMessage = {
  type: 'export';
  sheet: SerializedModel;
  decorated: Record<string, string>;
};

export type ImportMessage = {
  type: 'import';
  data: ArrayBuffer;
};

export type ExportCompleteMessage = {
  type: 'export-complete';
  blob: Blob;
};

export type ImportErrorMessage = {
  type: 'import-error';
  error: unknown;
};

export type ImportCompleteMessage = {
  type: 'import-complete';

  results: {
    sheets: ImportedSheetData[];
    named?:  (SerializedNamed & {
        local_scope?: number;
    })[];
    active_tab?: number;
  };
};

export type RXMessages = ExportMessage|ImportMessage;
export type TXMessages = ImportCompleteMessage|ImportErrorMessage|ExportCompleteMessage;


