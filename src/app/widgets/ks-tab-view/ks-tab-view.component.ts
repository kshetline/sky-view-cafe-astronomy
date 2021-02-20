import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';
import { KsTabComponent } from '../ks-tab/ks-tab.component';

@Component({
  selector: 'ks-tab-view',
  templateUrl: './ks-tab-view.component.html',
  styleUrls: ['./ks-tab-view.component.scss']
})
export class KsTabViewComponent implements AfterContentInit {
  private _activeTab = -1;

  @Output() change = new EventEmitter();

  @ContentChildren(KsTabComponent) tabs: QueryList<KsTabComponent>;

  get activeTab(): number { return this._activeTab; }
  @Input() set activeTab(value: number) {
    if (this._activeTab !== value && this.tabs) {
      this._activeTab = value;
      this.tabs.toArray().forEach((tab: KsTabComponent, index: number) => tab.active = (index === value));

      this.change.emit(value);
    }
  }

  selectTab(index: number): void {
    this.activeTab = index;
  }

  ngAfterContentInit(): void {
    this.activeTab = 0;
  }
}
