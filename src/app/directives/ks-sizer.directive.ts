import { Directive, ElementRef, HostBinding, Input, ViewContainerRef } from '@angular/core';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Directive({
  selector: '[ksSizer]'
})
export class KsSizerDirective {
  @HostBinding('style') style: string | SafeStyle;

  // eslint-disable-next-line accessor-pairs
  @Input() set ksSizer(size: string) {
    let [width, height] = size.split(',').map(s => s.trim());

    if (!width)
      width = 'auto';
    else if (!isNaN(Number(width)))
      width += 'px';

    if (!height)
      height = 'auto';
    else if (!isNaN(Number(height)))
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
    private viewContainerRef: ViewContainerRef
  ) {
    const vcr = viewContainerRef as any;

    if (vcr && vcr._data && vcr._data.componentView && vcr._data.componentView.component)
      this.hostComponent = vcr._data.componentView.component;
  }
}
