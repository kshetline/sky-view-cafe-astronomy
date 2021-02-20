import { Point } from '@tubular/math';

export function getXYForTouchEvent(event: TouchEvent, index = 0): Point {
  const touches = event.touches;

  if (touches.length <= index)
    return {x: -1, y: -1};

  const rect = (touches[index].target as HTMLElement).getBoundingClientRect();

  return {x: touches[index].clientX - rect.left, y: touches[0].clientY - rect.top};
}
