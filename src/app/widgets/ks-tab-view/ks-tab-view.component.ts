/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';
import { KsTabComponent } from '../ks-tab/ks-tab.component';

@Component({
  selector: 'ks-tab-view',
  templateUrl: './ks-tab-view.component.html',
  styleUrls: ['./ks-tab-view.component.scss']
})
export class KsTabViewComponent implements AfterContentInit {
  private _activeTab = -1;

  @Output() onChange = new EventEmitter();

  @ContentChildren(KsTabComponent) tabs: QueryList<KsTabComponent>;

  get activeTab(): number { return this._activeTab; }
  @Input() set activeTab(value: number) {
    if (this._activeTab !== value && this.tabs) {
      this._activeTab = value;
      this.tabs.toArray().forEach((tab: KsTabComponent, index: number) => tab.active = (index === value));

      this.onChange.emit(value);
    }
  }

  selectTab(index: number): void {
    this.activeTab = index;
  }

  ngAfterContentInit(): void {
    this.activeTab = 0;
  }
}
