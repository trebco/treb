
import { Area } from 'treb-base-types';

export interface UpdateHints {
  data?: boolean;
  layout?: boolean;
  style?: boolean;
  annotations?: boolean;
  freeze?: boolean;
}

export interface DataEvent {
  type: 'data';
  area?: Area;
}

export interface FlushEvent {
  type: 'flush';
}

export interface StyleEvent {
  type: 'style';
  area?: Area;
}

export type SheetEvent
  = DataEvent
  | StyleEvent
  | FlushEvent
  ;
