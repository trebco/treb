
import type { DataModel, ViewModel } from '../types/data_model';
import { BaseLayout } from './base_layout';

export class MockLayout extends BaseLayout {

  public constructor(model: DataModel, view: ViewModel) {
    super(model, view, true);
  }

  public InitializeInternal(): void {
    
  }

  protected UpdateGridTemplates(): void {
    
  }

  protected UpdateTileGridPosition(): void {
    
  }

  protected UpdateContainingGrid(): void {
    
  }

  public ResizeCursor(): void {
    
  }

}

