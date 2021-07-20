import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'ks-icon-button',
  templateUrl: './ks-icon-button.component.html',
  styleUrls: ['./ks-icon-button.component.scss'],
})
export class KsIconButtonComponent {
  private _disabled = false;
  private _icon = 'circle';

  @Output() click = new EventEmitter();

  get disabled(): boolean { return this._disabled; }
  @Input() set disabled(value: boolean) {
    this._disabled = value;
  }

  @Input() get icon(): string { return this._icon; }
  set icon(value: string) {
    this._icon = value;
  }

  onClick(evt: MouseEvent): void {
    evt.stopPropagation();
    evt.preventDefault();

    if (!this.disabled)
      this.click.emit(evt);
  }
}
