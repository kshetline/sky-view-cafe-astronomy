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

import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Observable, Subscription } from 'rxjs';
import { FontMetrics, getCssValue, getFont, getFontMetrics, getTextWidth, isWindows } from '../../util/ks-util';
import * as _ from 'lodash';

export interface SequenceItemInfo {
  value: string | number;
  editable: boolean;
  selected: boolean;
  fixedWidth?: boolean;
  indicator?: boolean;
  hidden?: boolean;
  sizing?: string | string[];
}

const BACKSPACE =  8;
const KEY_LEFT  = 37;
const KEY_UP    = 38;
const KEY_RIGHT = 39;
const KEY_DOWN  = 40;
const NAVIGATION_KEYS = [BACKSPACE, KEY_LEFT, KEY_UP, KEY_RIGHT, KEY_DOWN];

const KEY_REPEAT_DELAY = 500;
const KEY_REPEAT_RATE  = 100;
const WARNING_DURATION = 5000;

const NO_SELECTION = -1;
const SPIN_UP      = -2;
const SPIN_DOWN    = -3;

const FLASH_DURATION = 100;
const NORMAL_BACKGROUND    = 'white';
const DISABLED_BACKGROUND  = '#CCC';
const ERROR_BACKGROUND     = '#F67';
const VIEW_ONLY_BACKGROUND = 'black';
const WARNING_BACKGROUND   = '#FC6';

export const BACKGROUND_ANIMATIONS = trigger('displayState', [
      state('error',    style({backgroundColor: ERROR_BACKGROUND})),
      state('normal',   style({backgroundColor: NORMAL_BACKGROUND})),
      state('warning',  style({backgroundColor: WARNING_BACKGROUND})),
      state('viewOnly', style({backgroundColor: VIEW_ONLY_BACKGROUND})),
      state('disabled', style({backgroundColor: DISABLED_BACKGROUND})),
      transition('normal => error',  animate(FLASH_DURATION)),
      transition('error => normal',  animate(FLASH_DURATION)),
      transition('warning => error', animate(FLASH_DURATION)),
      transition('error => warning', animate(FLASH_DURATION))]);

const NORMAL_TEXT          = 'black';
const DISABLED_ARROW_COLOR = '#060';
const DISABLED_TEXT        = '#999';
const INDICATOR_TEXT       = 'blue';
const SELECTED_TEXT        = 'white';
const VIEW_ONLY_TEXT       = '#0F0';

const DEFAULT_BORDER_COLOR = '#D8D8D8';

@Component({
  selector: 'ks-sequence-editor',
  animations: [BACKGROUND_ANIMATIONS],
  templateUrl: './ks-sequence-editor.component.html',
  styleUrls: ['./ks-sequence-editor.component.scss']
})
export class KsSequenceEditorComponent implements AfterViewInit, OnInit, OnDestroy {
  private keyTimer: Subscription;
  private clickTimer: Subscription;
  private warningTimer: Subscription;
  private _viewOnly = false;
  private _blank = false;
  private scaled = false;
  private lastDelta = 1;
  @ViewChild('canvas') private canvasRef: ElementRef;

  protected canvas: HTMLCanvasElement;
  protected signDigit = -1;
  protected disabled = false;
  protected width = 180;
  protected height = 17;
  protected font: string;
  protected smallFont: string;
  protected fixedFont: string;
  protected smallFixedFont: string;
  protected hOffsets: number[] = [];
  protected items: SequenceItemInfo[] = [];
  protected hasFocus = false;
  protected selection = 0;

  public displayState = 'normal';

  protected static getPadding(metrics: FontMetrics): number {
    return Math.max(metrics.descent + 1, Math.floor(metrics.ascent / 2));
  }

  get viewOnly(): boolean { return this._viewOnly; }
  @Input() set viewOnly(value: boolean) {
    this._viewOnly = value;
    this.displayState = value ? 'viewOnly' : (this.disabled ? 'disabled' : 'normal');
  }

  get blank(): boolean { return this._blank; }
  @Input() set blank(value: boolean) {
    if (this._blank !== value) {
      this._blank = value;
      this.draw();
    }
  }

  protected checkForWarning(): void {
    if (this.shouldWarn())
      this.startWarning(); // Start or extend time in warning mode.
    else
      this.endWarning();
  }

  protected shouldWarn(): boolean {
    return false;
  }

  protected startWarning(): void {
    if (this.warningTimer)
      this.warningTimer.unsubscribe();

    this.displayState = 'warning';
    this.warningTimer = Observable.timer(WARNING_DURATION).subscribe(() => {
      this.endWarning();
    });
  }

  protected endWarning(): void {
    this.displayState = 'normal';

    if (this.warningTimer) {
      this.warningTimer.unsubscribe();
      this.warningTimer = undefined;
    }
  }

  ngOnInit(): void {
    this.createDigits();
  }

  protected createDigits(): void {
    this.selection = 10;
    for (let i = 0; i <= 10; ++i) {
      this.items.push({value: i === 5 ? ':' : i - (i > 5 ? 1 : 0), editable: i !== 5, selected: i === this.selection});
    }
  }

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.font = getFont(this.canvas);

    if (!this.font) {
      const fontStyle = getCssValue(this.canvas, 'font-style');
      const fontVariant = getCssValue(this.canvas, 'font-variant');
      const fontWeight = getCssValue(this.canvas, 'font-weight');
      const fontSize = parseFloat(getCssValue(this.canvas, 'font-size').replace('px', ''));
      const fontFamily = getCssValue(this.canvas, 'font-family');
      this.font = fontStyle + ' ' + fontVariant + ' ' + fontWeight + ' ' + fontSize + 'px ' + fontFamily;
    }

    this.smallFont = this.fixedFont = this.smallFixedFont = this.font;
    const fontParts = /(.*?\b)((?:\d|\.)+)(px\b)(\s*\/\s*\w+\s+)?(.*)/.exec(this.font);

    if (fontParts) {
      if (_.isUndefined(fontParts[4]))
        fontParts[4] = ' ';

      const fontSize = parseFloat(fontParts[2]);
      let smallerSize = Math.ceil(fontSize * 0.833);

      // A little platform-dependent tweaking is needed here or the font comes out too small.
      if (isWindows() && fontSize <= 12)
        smallerSize = fontSize;

      this.smallFont = fontParts[1] + smallerSize + fontParts[3] + fontParts[4] + fontParts[5];
      this.fixedFont = fontParts[1] + fontParts[2] + fontParts[3] + fontParts[4] + '"Lucida Console", "Lucida Sans Typewriter", Monaco, monospace';
      this.smallFixedFont = fontParts[1] + smallerSize + fontParts[3] + fontParts[4] + '"Lucida Console", "Lucida Sans Typewriter", Monaco, monospace';
    }

    this.computeSize();
    this.draw();
  }

  protected getFontForItem(item: SequenceItemInfo): string {
    if (item.fixedWidth && item.indicator)
      return this.smallFixedFont;
    else if (item.fixedWidth)
      return this.fixedFont;
    else if (item.indicator)
      return this.smallFont;
    else
      return this.font;
  }

  protected getColorForItem(item?: SequenceItemInfo, index?: number): string {
    if (this.disabled)
      return DISABLED_TEXT;
    else if (item && this._viewOnly)
      return VIEW_ONLY_TEXT;
    else if (this._viewOnly)
      return DISABLED_ARROW_COLOR;
    else if (item && item.indicator)
      return INDICATOR_TEXT;
    else
      return NORMAL_TEXT;
  }

  protected getStaticBackgroundColor(): string {
    if (this.disabled)
      return DISABLED_BACKGROUND;
    else if (this._viewOnly)
      return VIEW_ONLY_BACKGROUND;
    else
      return NORMAL_BACKGROUND;
  }

  protected computeSize(): void {
    const metrics: FontMetrics = getFontMetrics(this.canvas);
    const padding = KsSequenceEditorComponent.getPadding(metrics);
    let hOffset = padding;

    this.hOffsets = [];

    for (const item of this.items) {
      this.hOffsets.push(hOffset);
      hOffset += Math.floor(getTextWidth(item.sizing ? item.sizing : String(item.value), this.getFontForItem(item)));
    }

    this.hOffsets.push(hOffset);

    const w = hOffset + Math.ceil(metrics.ascent * 1.5) + padding;
    const h = metrics.ascent + padding * 2;
    const scaling = window.devicePixelRatio || 1;

    this.hOffsets.push(w);
    this.width = w;
    this.canvas.style.width = w + 'px';
    this.canvas.width = Math.ceil(w * scaling);
    this.height = h;
    this.canvas.style.height = h + 'px';
    this.canvas.height = Math.ceil(h * scaling);

    // Scaling is not reset with each call to getContext('2d'). It will have cumulative effect if done more than once.
    if (!this.scaled) {
      const context = this.canvas.getContext('2d');
      context.scale(scaling, scaling);
      this.scaled = true;
    }
  }

  protected draw(): void {
    if (!this.canvas)
      return;

    const metrics: FontMetrics = getFontMetrics(this.canvas);
    const padding = KsSequenceEditorComponent.getPadding(metrics);
    const h = this.height;
    const rightEdge = this.hOffsets[this.hOffsets.length - 2];
    const context = this.canvas.getContext('2d');

    if (!this.disabled && !this._viewOnly) {
      context.clearRect(0, 0, rightEdge, h);
      // You wouldn't think there's much difference between the transparent black produced by clearRect(), but
      // black text anti-aliases terribly when drawn on top of that. We need to fill the backing store with
      // transparent white so that we get both well-drawn text and the ability to see through to the sometimes-
      // animated background color of the canvas beneath the backing store.
      const pixel = context.getImageData(0, 0, 1, 1);
      pixel.data[0] = 255; pixel.data[1] = 255; pixel.data[2] = 255; pixel.data[3] = 0;
      context.putImageData(pixel, 0, 0, 0, 0, rightEdge, h);
    }
    else {
      // In disabled and view-only modes we don't have to worry about background animation, so filling with a
      // solid color works fine.
      context.fillStyle = this.getStaticBackgroundColor();
      context.fillRect(0, 0, rightEdge, h);
    }

    this.items.forEach((item: SequenceItemInfo, index: number) => {
      if (!item.hidden && (!item.editable || !this.blank)) {
        context.fillStyle = this.getColorForItem(item, index);

        if (index === this.selection && this.hasFocus && !this.disabled && !this._viewOnly) {
          context.fillRect(this.hOffsets[index], 1, this.hOffsets[index + 1] - this.hOffsets[index], h - 2);
          context.fillStyle = SELECTED_TEXT;
        }

        context.font = this.getFontForItem(item);
        context.fillText(String(item.value), this.hOffsets[index], padding + metrics.ascent);
      }
    });

    this.drawSpinner(context);
  }

  protected drawSpinner(context: CanvasRenderingContext2D): void {
    const metrics: FontMetrics = getFontMetrics(this.canvas);
    const h = this.height;
    const leftEdge = this.hOffsets[this.hOffsets.length - 2];
    const spinnerCenter = Math.ceil((leftEdge + this.width) / 2) + 0.5;
    const spinnerInset = h / 8;
    const arrowH = metrics.ascent / 2.5;
    const arrowV = metrics.ascent / 2;

    context.fillStyle = this.getStaticBackgroundColor();
    context.fillRect(leftEdge, 0, this.width - leftEdge, h);
    context.fillStyle = getCssValue(this.canvas, 'border-color') || DEFAULT_BORDER_COLOR;
    context.fillRect(leftEdge, 0, 1, h);
    context.fillStyle = this.getColorForItem();
    context.beginPath();
    context.moveTo(spinnerCenter, spinnerInset);
    context.lineTo(spinnerCenter - arrowH, spinnerInset + arrowV);
    context.lineTo(spinnerCenter + arrowH, spinnerInset + arrowV);
    context.fill();
    context.beginPath();
    context.moveTo(spinnerCenter, h - spinnerInset);
    context.lineTo(spinnerCenter - arrowH, h - spinnerInset - arrowV);
    context.lineTo(spinnerCenter + arrowH, h - spinnerInset - arrowV);
    context.fill();
  }

  ngOnDestroy(): void {
    this.stopKeyTimer();
    this.stopClickTimer();
  }

  protected errorFlash(): void {
    this.displayState = 'error';
    Observable.timer(FLASH_DURATION).subscribe(() => { this.displayState = (this.warningTimer ? 'warning' : 'normal'); });
  }

  protected stopKeyTimer(): void {
    if (this.keyTimer) {
      this.keyTimer.unsubscribe();
      this.keyTimer = undefined;
    }
  }

  protected stopClickTimer(): void {
    if (this.clickTimer) {
      this.clickTimer.unsubscribe();
      this.clickTimer = undefined;
    }
  }

  protected getSelectionForEvent(event: MouseEvent): number {
    const newSelection = _.findIndex(this.hOffsets, (offset: number, index: number) => {
      return offset <= event.offsetX && event.offsetX < this.hOffsets[Math.min(index + 1, this.hOffsets.length - 1)];
    });

    if (newSelection >= this.items.length)
      return (event.offsetY < this.height / 2 ? SPIN_UP : SPIN_DOWN);

    // If this item isn't selectable, move left until a selectable item is found.
    // If going left doesn't work, try looking to the right.
    let nextSelection = NO_SELECTION;

    for (let i = newSelection; i >= 0; --i) {
      if (this.items[i].editable) {
        nextSelection = i;
        break;
      }
    }

    if (nextSelection === NO_SELECTION) {
      for (let i = newSelection + 1; i < this.items.length; ++i) {
        if (this.items[i].editable) {
          nextSelection = i;
          break;
        }
      }
    }

    return nextSelection;
  }

  onAnimate(): void {
    this.draw();
  }

  onMouseDown(event: MouseEvent): void {
    const newSelection = this.getSelectionForEvent(event);

    if ((newSelection === SPIN_UP || newSelection === SPIN_DOWN) && !this.clickTimer) {
      this.lastDelta = newSelection === SPIN_UP ? 1 : -1;

      this.clickTimer = Observable.timer(KEY_REPEAT_DELAY, KEY_REPEAT_RATE).subscribe(() => {
        this.onSpin(this.lastDelta);
      });
    }
  }

  onMouseUp(): void {
    if (this.clickTimer) {
      this.stopClickTimer();
      this.onSpin(this.lastDelta);
    }
  }

  onClick(event: MouseEvent): void {
    if (this.disabled || this.viewOnly)
      return;

    const newSelection = this.getSelectionForEvent(event);

    if (this.selection !== newSelection && newSelection !== SPIN_UP && newSelection !== SPIN_DOWN) {
      this.items[this.selection].selected = false;
      this.selection = newSelection;
      this.items[this.selection].selected = true;
      this.draw();
    }
  }

  onFocus(value: boolean): void {
    if (this.hasFocus !== value) {
      this.hasFocus = value;
      this.draw();

      if (value)
        this.gainedFocus();
      else
        this.lostFocus();
    }
  }

  protected gainedFocus(): void {}
  protected lostFocus(): void {}

  onKeyDown(event: KeyboardEvent): void {
    if (NAVIGATION_KEYS.includes(event.keyCode) && !this.keyTimer) {
      this.keyTimer = Observable.timer(KEY_REPEAT_DELAY, KEY_REPEAT_RATE).subscribe(() => {
        this.onKey(event);
      });
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (NAVIGATION_KEYS.includes(event.keyCode)) {
      this.stopKeyTimer();
      this.onKey(event);
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    // Firefox, unlike Chrome, creates keypress events for arrow keys, which will lead to doubled
    // effect if we don't filter out these extra events.
    if (NAVIGATION_KEYS.includes(event.keyCode))
      return;

    this.onKey(event);
  }

  protected onKey(event: KeyboardEvent): void {
    if (this.disabled || this.viewOnly)
      return;

    let keyCode = event.keyCode;
    const key = event.key;

    if (!this.hasFocus || !this.items[this.selection].editable) {
      return;
    }

    if (this.selection !== this.signDigit) {
      if (key === '-')
        keyCode = KEY_DOWN;
      else if (key === '+' || key === '=')
        keyCode = KEY_UP;
    }

    switch (keyCode) {
      case KEY_UP:
        this.increment();
      break;

      case KEY_DOWN:
        this.decrement();
      break;

      case BACKSPACE:
      case KEY_LEFT:
        this.cursorLeft();
      break;

      case KEY_RIGHT:
        this.cursorRight();
      break;

      default:
        this.digitTyped(event.charCode, key);
    }
  }

  protected onSpin(delta: number): void {
    if (this.disabled || this.viewOnly)
      return;

    if (delta > 0)
      this.increment();
    else if (delta < 0)
      this.decrement();
  }

  protected cursorLeft(): void {
    let nextSelection = NO_SELECTION;

    for (let i = this.selection - 1; i >= 0; --i) {
      if (this.items[i].editable) {
        nextSelection = i;
        break;
      }
    }

    if (nextSelection !== NO_SELECTION) {
      this.items[this.selection].selected = false;
      this.selection = nextSelection;
      this.items[this.selection].selected = true;
    }

    this.draw();
  }

  protected cursorRight(): void {
    let nextSelection = -1;

    for (let i = this.selection + 1; i < this.items.length; ++i) {
      if (this.items[i].editable) {
        nextSelection = i;
        break;
      }
    }

    if (nextSelection >= 0) {
      this.items[this.selection].selected = false;
      this.selection = nextSelection;
      this.items[this.selection].selected = true;
    }

    this.draw();
  }

  protected increment(): void {
    this.items[this.selection].value = (<number> this.items[this.selection].value + 1) % 10;
  }

  protected decrement(): void {
    this.items[this.selection].value = (<number> this.items[this.selection].value + 9) % 10;
  }

  protected digitTyped(charCode: number, key: string): void {
    if (48 <= charCode && charCode < 58) {
      this.items[this.selection].value = charCode - 48;
      this.cursorRight();
    }
  }
}
