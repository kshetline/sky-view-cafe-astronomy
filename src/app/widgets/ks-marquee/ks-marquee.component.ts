import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { addResizeListener, removeResizeListener } from 'detect-resize';
import { min } from '@tubular/math';
import { getTextWidth } from '@tubular/util';

const HOLD_TIME = 1500;
const MARQUEE_SPEED = 100; // pixels per second.

@Component({
  selector: 'ks-marquee',
  templateUrl: './ks-marquee.component.html',
  styleUrls: ['./ks-marquee.component.scss'],
})
export class KsMarqueeComponent implements AfterViewInit, OnDestroy {
  private _text = '';
  private resizeFunction: () => void;
  private wrapper: HTMLElement;
  private marquee: HTMLElement;
  private animationRequestId = 0;
  private animationStart: number;
  private animationWidth: number;
  private animationDuration: number;

  @ViewChild('wrapper', { static: true }) wrapperRef: ElementRef;
  @ViewChild('marquee', { static: true }) marqueeRef: ElementRef;

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
    this.resizeFunction = (): void => this.onResize();
    addResizeListener(this.wrapper, this.resizeFunction);
    this.onResize();
  }

  ngOnDestroy(): void {
    if (this.resizeFunction)
      removeResizeListener(this.wrapper, this.resizeFunction);

    if (this.animationRequestId)
      window.cancelAnimationFrame(this.animationRequestId);
  }

  onResize(): void {
    if (this.animationRequestId) {
      window.cancelAnimationFrame(this.animationRequestId);
      this.animationRequestId = 0;
    }

    if (!this.wrapper || !this.marquee)
      return;

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
      const timeIntoScroll = now - this.animationStart - HOLD_TIME;

      this.marquee.scrollLeft = min(this.animationWidth, timeIntoScroll / 1000 * MARQUEE_SPEED);
    }

    this.animationRequestId = window.requestAnimationFrame(() => this.animate());
  }
}
