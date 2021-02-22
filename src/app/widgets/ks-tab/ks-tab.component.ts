import { Component, Input } from '@angular/core';

@Component({
  selector: 'ks-tab',
  templateUrl: './ks-tab.component.html',
  styles: ['.ks-tab { height: 100%; }']
})
export class KsTabComponent {
  @Input() header = '';
  @Input() active = false;
}
