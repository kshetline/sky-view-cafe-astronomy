/*
  Copyright © 2018 Kerry Shetline, kerry@shetline.com

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

import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { addResizeListener, removeResizeListener } from 'detect-resize';
import { getTextWidth } from 'ks-util';
import { min } from 'ks-math';

const HOLD_TIME = 1500;
const MARQUEE_SPEED = 100; // pixels per second.

@Component({
  selector: 'ks-marquee',
  templateUrl: './ks-marquee.component.html',
  styleUrls: ['./ks-marquee.component.scss'],
})
export class KsMarqueeComponent implements AfterViewInit, OnDestroy {
  private _text = '';
  private resizeFunction: Function;
  private wrapper: HTMLElement;
  private marquee: HTMLElement;
  private animationRequestId = 0;
  private animationStart: number;
  private animationWidth: number;
  private animationDuration: number;

  @ViewChild('wrapper') wrapperRef: ElementRef;
  @ViewChild('marquee') marqueeRef: ElementRef;

  @Input() get text(): string { return this._text; }
  set text(value: string) {
    if (this._text !== value) {
      this._text = value;
      this.onResize();
    }
  }

  ngAfterViewInit(): void {
    this.wrapper = this.wrapperRef.nativeElement;
    this.marquee = this.marqueeRef.nativeElement;
    this.resizeFunction = () => this.onResize();
    addResizeListener(this.wrapper, this.resizeFunction);
  }

  ngOnDestroy(): void {
    if (this.resizeFunction)
      removeResizeListener(this.wrapper, this.resizeFunction);

    if (this.animationRequestId)
      window.cancelAnimationFrame(this.animationRequestId);
  }

  onResize(): void {
    if (this.animationRequestId)
      window.cancelAnimationFrame(this.animationRequestId);

    const marqueeWidth = this.wrapper.offsetWidth;
    const textWidth = getTextWidth(this.text, this.marquee);

    this.marquee.style.width = marqueeWidth + 'px';
    this.marquee.scrollLeft = 0;
    if (textWidth <= marqueeWidth)
      return;

    this.animationStart = performance.now();
    this.animationWidth = textWidth - marqueeWidth;
    this.animationDuration = HOLD_TIME * 2 + this.animationWidth / MARQUEE_SPEED * 1000;
    this.animationRequestId = window.requestAnimationFrame(() => this.animate());
  }

  private animate(): void {
    const now = performance.now();

    if (now > this.animationStart + this.animationDuration) {
      this.animationStart = now;
      this.marquee.scrollLeft = 0;
    }
    else if (now > this.animationStart + HOLD_TIME) {
      const timeIntoSlide = now - this.animationStart - HOLD_TIME;

      this.marquee.scrollLeft = min(this.animationWidth, timeIntoSlide / 1000 * MARQUEE_SPEED);
    }

    this.animationRequestId = window.requestAnimationFrame(() => this.animate());
  }
}
