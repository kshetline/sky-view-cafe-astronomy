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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// To work around IE's lack of support for slice on Uint8ClampedArray. The standard polyfills apparently don't fix this.
function altSlice(array: Uint8ClampedArray, start: number, end: number): ArrayLike<number> {
  try {
    return array.slice(start, end);
  }
  catch (e) {}

  const result = [];

  for (let i = start; i < end; ++i)
    result.push(array[i]);

  return result;
}

@Injectable()
export class JpegCommentReader {
  constructor(private httpClient: HttpClient) {
  }

  readComment(imageSrc: string): Promise<string> {
    return this.httpClient.get(imageSrc, {responseType: 'arraybuffer'}).toPromise().then(data => {
      const imageBytes = new Uint8ClampedArray(data);

      if (imageBytes.length < 10 ||
          imageBytes[0] !== 0xFF ||
          imageBytes[1] !== 0xD8 ||
          imageBytes[2] !== 0xFF ||
          imageBytes[3] !== 0xE0 ||
          // ignore bytes 4 and 5
          imageBytes[6] !== 'J'.charCodeAt(0) ||
          imageBytes[7] !== 'F'.charCodeAt(0) ||
          imageBytes[8] !== 'I'.charCodeAt(0) ||
          imageBytes[9] !== 'F'.charCodeAt(0))
        return null;

      const len = imageBytes.length;
      let offset = 2;

      while (offset < len) {
        // Look for a header data block;
        while (imageBytes[offset] !== 0xFF && offset < len)
          ++offset;

        if (offset >= len)
          return null;

        // Skip over extra 0xFF bytes (if any) to get to the header item's type byte.
        while (imageBytes[offset] === 0xFF && offset < len)
          ++offset;

        if (offset >= len + 3)
          return null;

        const itemType = imageBytes[offset] & 0xFF;
        const itemLength = ((imageBytes[offset + 1] & 0xFF) << 8) | (imageBytes[offset + 2] & 0xFF);

        // 0xFE is comment marker.
        if (offset + itemLength >= len)
          return null;
        else if (itemType === 0xFE && itemLength > 2) {
          const commentBytes = altSlice(imageBytes, offset + 3, offset + itemLength + 1);
          const commentChars: string[] = [];

          // I'd use commentBytes.map(...) here, but a Uint8ClampedArray refuses to map to a string array.
          for (let i = 0; i < commentBytes.length; ++i)
            commentChars[i] = String.fromCharCode(commentBytes[i]);

          return commentChars.join('');
        }
        else if (itemType === 0xDA) // Stop looking when we reach the SOS (Start Of Scan) marker.
          return null;

        offset += itemLength;
      }

      return null;
    });
  }
}
