/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import type { FunctionDescriptor } from 'treb-grid';

/**
 * this is similar to a function descriptor, but we need a lot less
 * information. not sure if we should composite them.
 */
export interface TranslatedFunctionDescriptor extends FunctionDescriptor {

  /** original name (name in english), so we know what to replace. */
  base: string;

}

export interface LanguageModel {
  name: string;
  version?: string;
  locale?: string;
  functions?: TranslatedFunctionDescriptor[];
}

