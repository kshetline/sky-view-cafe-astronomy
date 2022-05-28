export class MapClass<T, U> {
  map = new Map<T, U>();

  clear(): void {
    this.map.clear();
  }

  delete(key: T): boolean {
    return this.map.delete(key);
  }

  get entries(): [T, U][] {
    return Array.from(this.map.entries());
  }

  forEach(callback: (value: U, key?: T, map?: Map<T, U>) => void): void {
    this.map.forEach(callback);
  }

  get(key: T): U {
    return this.map.get(key);
  }

  has(key: T): boolean {
    return this.map.has(key);
  }

  get keys(): T[] {
    return Array.from(this.map.keys());
  }

  set(key: T, value: U): MapClass<T, U> {
    this.map.set(key, value);
    return this;
  }

  get size(): number { return this.map.size; }

  get values(): U[] {
    return Array.from(this.map.values());
  }
}
