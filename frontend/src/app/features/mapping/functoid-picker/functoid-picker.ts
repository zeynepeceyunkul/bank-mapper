import { Component, Input } from '@angular/core';
import { FunctoidDefinition } from '../../../core/models/functoid.model';

@Component({
  selector: 'app-functoid-picker',
  imports: [],
  templateUrl: './functoid-picker.html',
  styleUrl: './functoid-picker.scss',
})
export class FunctoidPicker {
  @Input() definitions: FunctoidDefinition[] = [];

  onDragStart(event: DragEvent, code: string): void {
    event.dataTransfer?.setData('text/functoid-code', code);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }
}
