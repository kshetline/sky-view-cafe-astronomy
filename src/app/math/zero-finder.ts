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

export class ZeroFinder {
  private _iterationCount = 0;
  private y: number;

  constructor(private zeroSeekingFunction: Function, private tolerance: number, private maxIterations: number,
              private x1: number, private y1: number, private x2: number, private y2: number) {
  }

  public getXAtZero(): number {
    let x: number;

    this._iterationCount = 0;

    while (++this._iterationCount <= this.maxIterations) {
      x = this.x1 - this.y1 / (this.y2 - this.y1) * (this.x2 - this.x1);
      this.y = this.zeroSeekingFunction(x);

      if (Math.abs(this.y) <= this.tolerance)
        break;

      if ((this.y1 < this.y2 && this.y < 0.0) || (this.y1 > this.y2 && this.y > 0.0)) {
        this.x1 = x;
        this.y1 = this.y;
      }
      else {
        this.x2 = x;
        this.y2 = this.y;
      }
    }

    return x;
  }

  public get lastY(): number { return this.y; }

  public get iterationCount(): number { return this._iterationCount; }
}
