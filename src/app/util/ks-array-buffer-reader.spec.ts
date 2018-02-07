import { KsArrayBufferReader } from './ks-array-buffer-reader';

describe('KsArrayBufferReader', () => {
  const testText = 'first line\n#second line\r\nthird#line\rfourth line';
  const testArray = testText.split('').map(c => c.charCodeAt(0));
  const reader = new KsArrayBufferReader(testArray);

  it('should read lines correctly, line-ending agnostic.', () => {
    let line = reader.readAnsiLine();
    expect(line === 'first line').toBeTruthy();
    line = reader.readAnsiLine();
    expect(line === '#second line').toBeTruthy();
    line = reader.readAnsiLine();
    expect(line === 'third#line').toBeTruthy();
    line = reader.readAnsiLine();
    expect(line === 'fourth line').toBeTruthy();
  });

  it('should reset offset and ignore # comments correctly.', () => {
    reader.offset = 0;
    let line = reader.readAnsiLine(true);
    expect(line === 'first line').toBeTruthy();
    line = reader.readAnsiLine(true);
    expect(line === 'third').toBeTruthy();
    line = reader.readAnsiLine(true);
    expect(line === 'fourth line').toBeTruthy();
  });

  it('should get null if trying to read a line at EOF.', () => {
    const line = reader.readAnsiLine(true);
    expect(line === null).toBeTruthy();
  });
});
