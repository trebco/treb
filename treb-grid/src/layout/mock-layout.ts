
import type { DataModel, ViewModel } from '../types/data_model';
import type { Tile } from '../types/tile';
import { BaseLayout } from './base_layout';

export class MockLayout extends BaseLayout {

  public constructor(model: DataModel, view: ViewModel) {
    super(model, view, true);
  }

  public InitializeInternal(container: HTMLElement, scroll_callback: () => void): void {
    
  }

  protected UpdateGridTemplates(columns: boolean, rows: boolean): void {
    
  }

  protected UpdateTileGridPosition(tile: Tile): void {
    
  }

  protected UpdateContainingGrid(): void {
    
  }

  public ResizeCursor(resize?: 'row' | 'column' | undefined): void {
    
  }

}

