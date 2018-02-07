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

import * as _ from 'lodash';
import { floor, max, min, round } from './ks-math';

export interface FontMetrics {
  font: string;
  lineHeight: number;
  ascent: number;
  fullAscent: number;
  descent: number;
  leading: number;
}

export function extendDelimited(base: string, newItem: string, delimiter = ', '): string {
  if (!base)
    return newItem;
  else
    return base + delimiter + newItem;
}

export function beep(): void {
  const audioContext: AudioContext = <AudioContext> new((<any> window)['AudioContext']);
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = 'square';
  oscillator.frequency.value = 440;
  oscillator.connect(gain);
  gain.gain.value = 0.025;
  gain.connect(audioContext.destination);

  oscillator.start();

  setTimeout(() => {
    oscillator.stop();
    oscillator.disconnect();
    gain.disconnect();
    audioContext.close();
  }, 100);
}

export function getCssValue(element: Element, property: string): string {
  return document.defaultView.getComputedStyle(element, null).getPropertyValue(property);
}

export function getFont(element: Element): string {
  let font = getCssValue(element, 'font');

  if (!font) {
    const fontStyle = getCssValue(element, 'font-style');
    const fontVariant = getCssValue(element, 'font-variant');
    const fontWeight = getCssValue(element, 'font-weight');
    const fontSize = parseFloat(getCssValue(element, 'font-size').replace('px', ''));
    const fontFamily = getCssValue(element, 'font-family');
    font = fontStyle + ' ' + fontVariant + ' ' + fontWeight + ' ' + fontSize + 'px ' + fontFamily;
  }

  return font;
}

const cachedMetrics: {[font: string]: FontMetrics} = {};

export function getFontMetrics(elementOrFont: Element | string): FontMetrics {
  let font;

  if (_.isString(elementOrFont))
    font = <string> elementOrFont;
  else
    font = getFont(<Element> elementOrFont);

  let metrics: FontMetrics = cachedMetrics[font];

  if (metrics)
    return metrics;

  let testFont = font;
  let fontSize = 12;
  let testFontSize = 12;
  const fontParts = /(.*?\b)((?:\d|\.)+)(px\b.*)/.exec(font);

  // Double the font size so there's more pixel detail to scan, then scale down the result afterward.
  if (fontParts) {
    fontSize = parseFloat(fontParts[2]);
    testFontSize = fontSize * 2;
    testFont = fontParts[1] + testFontSize + fontParts[3];
  }

  const PADDING = 50;
  const sampleText1 = 'Eg';
  const sampleText2 = 'ÅÊ';

  let lineHeight = fontSize * 1.2;
  const heightDiv = <HTMLDivElement> <any> document.createElement('div');

  heightDiv.style.position = 'absolute';
  heightDiv.style.opacity = '0';
  heightDiv.style.font = font;
  heightDiv.innerHTML = sampleText1 + '<br>' + sampleText1;
  document.body.appendChild(heightDiv);

  const heightDivHeight = parseFloat(getCssValue(heightDiv, 'height').replace('px', ''));

  if (heightDivHeight >= fontSize * 2)
    lineHeight = heightDivHeight / 2;

  document.body.removeChild(heightDiv);

  const canvas = (<any> getFontMetrics).canvas || ((<any> getFontMetrics).canvas =
                  <HTMLCanvasElement> <any> document.createElement('canvas'));

  canvas.width = testFontSize * 2 + PADDING;
  canvas.height = testFontSize * 3;
  canvas.style.opacity = '1';

  const context = canvas.getContext('2d');
  const w = canvas.width, w4 = w * 4, h = canvas.height, baseline = h / 2;

  context.fillStyle = 'white';
  context.fillRect(-1, -1, w + 2, h + 2);
  context.fillStyle = 'black';
  context.font = testFont;
  context.fillText(sampleText1, PADDING / 2, baseline);

  let pixels = context.getImageData(0, 0, w, h).data;
  let i = 0;
  const len = pixels.length;

  // Finding the ascent uses a normal, forward scanline
  while (++i < len && pixels[i] > 192) {}
  let ascent = Math.floor(i / w4);

  // Finding the descent uses a reverse scanline
  i = len - 1;
  while (--i > 0 && pixels[i] > 192) {}
  let descent = Math.floor(i / w4);

  context.fillStyle = 'white';
  context.fillRect(-1, -1, w + 2, h + 2);
  context.fillStyle = 'black';
  context.fillText(sampleText2, PADDING / 2, baseline);
  pixels = context.getImageData(0, 0, w, h).data;

  // Finding the full ascent, including diacriticals.
  i = 0;
  while (++i < len && pixels[i] > 192) {}
  let fullAscent = Math.floor(i / w4);

  ascent = baseline - ascent;
  fullAscent = baseline - fullAscent;
  descent = descent - baseline;

  if (testFontSize > fontSize) {
    ascent = Math.ceil(ascent / 2);
    fullAscent = Math.ceil(fullAscent / 2);
    descent = Math.ceil(descent / 2);
  }
  const leading = lineHeight - fullAscent - descent;

  metrics = {font: font, lineHeight: lineHeight, ascent: ascent, fullAscent: fullAscent, descent: descent, leading: leading};
  cachedMetrics[font] = metrics;

  return metrics;
}

export function getTextWidth(items: string | string[], font: string | HTMLElement): number {
  const canvas = <HTMLCanvasElement> ((<any> getTextWidth).canvas ||
                  ((<any> getTextWidth).canvas = <HTMLCanvasElement> <any> document.createElement('canvas')));
  const context = canvas.getContext('2d');
  let maxWidth = 0;

  if (_.isString(font))
    context.font = (font ? font : 'normal 12px sans-serif');
  else if (_.isObject(font))
    context.font = font.style.font;

  if (!_.isArray(items))
    items = [items];

  for (const item of items) {
    const width = context.measureText(item).width;
    maxWidth = Math.max(maxWidth, width);
  }

  return maxWidth;
}

export function restrictPixelWidth(text: string, font: string | HTMLElement, maxWidth: number, clipString = '\u2026'): string {
  let width = getTextWidth(text, font);
  let takeOffEnd = 1;

  while (width > maxWidth) {
    text = text.substring(0, text.length - takeOffEnd) + clipString;
    takeOffEnd = 1 + clipString.length;
    width = getTextWidth(text, font);
  }

  return text;
}

export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent) && !isEdge();
}

export function isFirefox(): boolean {
  return /firefox/i.test(navigator.userAgent) && !/seamonkey/i.test(navigator.userAgent);
}

export function isIE(): boolean {
  return /(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:)(\d+)/.test(navigator.userAgent);
}

export function isEdge(): boolean {
  return /\bedge\b/i.test(navigator.userAgent) && isWindows();
}

export function isWindows(): boolean {
  return navigator.appVersion.includes('Windows') || navigator.platform.startsWith('Win');
}

export function padLeft(item: string | number, length: number, padChar = ' '): string {
  let sign = '';

  if (typeof item === 'number' && <number> item < 0 && padChar === '0') {
    sign = '-';
    item = -item;
    --length;
  }

  let result = String(item);

  while (result.length < length) {
    result = padChar + result;
  }

  return sign + result;
}

export function padRight(item: string, length: number, padChar?: string): string {
  if (!padChar) {
    padChar = ' ';
  }

  while (item.length < length) {
    item += padChar;
  }

  return item;
}

export function urlEncodeParams(params: { [key: string]: string }): string {
  const result: string[] = [];

  _.forEach(params, (value: string, key: string) => {
    if (!_.isNil(value))
      result.push(key + '=' + encodeURIComponent(value));
  });

  return result.join('&');
}

export function compareStrings(a: string, b: string): number {
  return (a < b ? -1 : (a > b ? 1 : 0));
}

export function compareCaseInsensitive(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();

  return (a < b ? -1 : (a > b ? 1 : 0));
}

export function compareCaseSecondary(a: string, b: string): number {
  const a1 = a.toLowerCase();
  const b1 = b.toLowerCase();
  const result = (a1 < b1 ? -1 : (a1 > b1 ? 1 : 0));

  if (result !== 0)
    return result;

  return (a < b ? -1 : (a > b ? 1 : 0));
}

export function replace(str: string, searchStr: string, replaceStr: string, caseInsensitive = false): string {
  // escape regexp special characters in search string
  searchStr = searchStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  return str.replace(new RegExp(searchStr, 'g' + (caseInsensitive ? 'i' : '')), replaceStr);
}

export function strokeLine(context: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  context.beginPath();
  context.moveTo(x0, y0);
  context.lineTo(x1, y1);
  context.stroke();
  context.closePath();
}

export function strokeCircle(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2, false);
  context.stroke();
  context.closePath();
}

export function strokeEllipse(context: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  context.save();
  context.beginPath();

  context.translate(cx - rx, cy - ry);
  context.scale(rx, ry);
  context.arc(1, 1, 1, 0, Math.PI * 2, false);

  context.restore();
  context.stroke();
  context.closePath();
}

export function fillEllipse(context: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  context.save();
  context.beginPath();

  context.translate(cx - rx, cy - ry);
  context.scale(rx, ry);
  context.arc(1, 1, 1, 0, Math.PI * 2, false);

  context.restore();
  context.fill();
}

export function colorFromRGB(r: number, g: number, b: number, alpha = 1.0): string {
  r = min(max(round(r), 0), 255);
  g = min(max(round(g), 0), 255);
  b = min(max(round(b), 0), 255);

  if (alpha === 1.0)
    return ('#' + padLeft(r.toString(16), 2, '0')
                + padLeft(g.toString(16), 2, '0')
                + padLeft(b.toString(16), 2, '0')).toUpperCase();
  else
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

export function colorFrom24BitInt(i: number, alpha = 1.0): string {
  const r = (i & 0xFF0000) >> 16;
  const g = (i & 0x00FF00) >> 8;
  const b =  i & 0x0000FF;

  return colorFromRGB(r, g, b, alpha);
}

export function colorFromByteArray(array: number[], offset: number): string {
  const r = array[offset];
  const g = array[offset + 1];
  const b = array[offset + 2];
  const alpha = array[offset + 4] / 255;

  return colorFromRGB(r, g, b, alpha);
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

const colorNameRegex = /[a-z]+/i;
const rgbRegex  =  /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/;
const rgbaRegex = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/;

let utilContext: CanvasRenderingContext2D;

export function parseColor(color: string): RGBA {
  let match = colorNameRegex.exec(color);

  if (match) {
    if (!utilContext) {
      const canvas = <HTMLCanvasElement> <any> document.createElement('canvas');
      utilContext = canvas.getContext('2d');
    }

    utilContext.fillStyle = color; // Let the context parse the color name.
    color = String(utilContext.fillStyle); // Get the same color back in hex/RGB form.
  }

  if (color.startsWith('#')) {
    if (color.length === 4)
      return {r: parseInt(color.substr(1, 1) + color.substr(1, 1), 16),
              g: parseInt(color.substr(2, 1) + color.substr(2, 1), 16),
              b: parseInt(color.substr(3, 1) + color.substr(3, 1), 16),
              alpha: 1.0};
    else if (color.length === 7)
      return {r: parseInt(color.substr(1, 2), 16),
              g: parseInt(color.substr(3, 2), 16),
              b: parseInt(color.substr(5, 2), 16),
              alpha: 1.0};
  }

  match = rgbRegex.exec(color);

  if (match)
    return {r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), alpha: 1};

  match = rgbaRegex.exec(color);

  if (match)
    return {r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), alpha: Number(match[4])};

  return {r: 0, g: 0, b: 0, alpha: 0};
}

export function replaceAlpha(color: string, newAlpha: number): string {
  const rgba = parseColor(color);

  return colorFromRGB(rgba.r, rgba.g, rgba.b, newAlpha);
}

export function blendColors(color1: string, color2: string): string {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  const r1 = c1.r;
  const g1 = c1.g;
  const b1 = c1.b;
  const a1 = c1.alpha;
  const r2 = c2.r;
  const g2 = c2.g;
  const b2 = c2.b;
  const a2 = c2.alpha;

  return colorFromRGB(floor((r1 + r2 + 1) / 2),
                      floor((g1 + g2 + 1) / 2),
                      floor((b1 + b2 + 1) / 2),
                            (a1 + a2)     / 2);
}

export function drawOutlinedText(context: CanvasRenderingContext2D, text: string, x: number, y: number,
                                 outlineStyle?: string, fillStyle?: string): void {
  context.save();
  context.lineWidth = 4;
  context.lineJoin = 'round';

  if (outlineStyle)
    context.strokeStyle = outlineStyle;

  if (fillStyle)
    context.fillStyle = fillStyle;

  context.strokeText(text, x, y);
  context.fillText(text, x, y);
  context.restore();
}

export function getPixel(imageData: ImageData, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height)
    return 0;

  const offset = (y * imageData.width + x) * 4;

  return (imageData.data[offset    ] << 16) |
         (imageData.data[offset + 1] <<  8) |
          imageData.data[offset + 2]        |
         (imageData.data[offset + 3] << 24);
}

export function setPixel(imageData: ImageData, x: number, y: number, pixel: number): void {
  if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height)
    return;

  const offset = (y * imageData.width + x) * 4;

  imageData.data[offset    ] =  (pixel & 0x00FF0000) >> 16;
  imageData.data[offset + 1] =  (pixel & 0x0000FF00) >>  8;
  imageData.data[offset + 2] =   pixel & 0x000000FF;
  imageData.data[offset + 3] = ((pixel & 0xFF000000) >> 24) & 0xFF;
}

export function toDefaultLocaleFixed(n: number, minFracDigits?: number, maxFracDigits?: number): string {
  const options: any = {};

  if (minFracDigits !== undefined)
    options.minimumFractionDigits = minFracDigits;

  if (maxFracDigits !== undefined)
    options.maximumFractionDigits = maxFracDigits;

  return n.toLocaleString(undefined, options);
}
