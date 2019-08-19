/*
  Copyright © 2019 Kerry Shetline, kerry@shetline.com.

  This code is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This code is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this code.  If not, see <http://www.gnu.org/licenses/>.

  For commercial, proprietary, or other uses not compatible with
  GPL-3.0-or-later, terms of licensing for this code may be
  negotiated by contacting the author, Kerry Shetline, otherwise all
  other uses are restricted.
*/

import { Directive, ElementRef, HostBinding, Input, ViewContainerRef } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { toNumber } from 'ks-util';

@Directive({
  selector: '[ksSizer]'
})
export class KsSizerDirective {
  @HostBinding('style') style: string | SafeStyle;

  @Input() set ksSizer(size: string) {
    let [width, height] = size.split(',').map(s => s.trim());

    if (!width)
      width = 'auto';
    else if (toNumber(width) !== 0)
      width += 'px';

    if (!height)
      height = 'auto';
    else if (toNumber(height) !== 0)
      height += 'px';

    if (this.hostComponent)
      this.hostComponent.style = { width, height };
    else {
      const style = `width: ${width}; height: ${height};`;
      this.style = this.sanitizer.bypassSecurityTrustStyle(style);
    }
  }

  hostComponent: any;

  constructor(
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef,
    viewContainerRef: ViewContainerRef
  ) {
    const vcr = viewContainerRef as any;

    if (vcr && vcr._data && vcr._data.componentView && vcr._data.componentView.component) {
      const comp = vcr._data.componentView.component;

      if (comp.el instanceof ElementRef && comp.el.nativeElement)
        this.hostComponent = comp;
    }
  }
}
