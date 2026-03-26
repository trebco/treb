import type { TextElement } from "../spreadsheetml/util.js";

// --- Core Properties (docProps/core.xml) ---
// Dublin Core + cp namespace

export interface CoreProperties {
  title?: TextElement;
  subject?: TextElement;
  creator?: TextElement;
  keywords?: TextElement;
  description?: TextElement;
  lastModifiedBy?: TextElement;
  revision?: TextElement;
  created?: TextElement;
  modified?: TextElement;
  category?: TextElement;
  contentStatus?: TextElement;
}

// --- Extended Properties (docProps/app.xml) ---

export interface ExtendedProperties {
  Application?: TextElement;
  DocSecurity?: TextElement;
  ScaleCrop?: TextElement;
  HeadingPairs?: Record<string, unknown>;
  TitlesOfParts?: Record<string, unknown>;
  Company?: TextElement;
  LinksUpToDate?: TextElement;
  SharedDoc?: TextElement;
  HyperlinksChanged?: TextElement;
  AppVersion?: TextElement;
  Manager?: TextElement;
  Template?: TextElement;
  TotalTime?: TextElement;
  Pages?: TextElement;
  Words?: TextElement;
  Characters?: TextElement;
  PresentationFormat?: TextElement;
  Lines?: TextElement;
  Paragraphs?: TextElement;
  Slides?: TextElement;
  Notes?: TextElement;
  HiddenSlides?: TextElement;
  MMClips?: TextElement;
}
