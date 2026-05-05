import React from 'react'
import { PANE_GRID } from './types'

export function LayoutIcon({ count, size }: { count: number; size: number }): React.ReactElement {
  const [cols, rows] = PANE_GRID[count] ?? [1, 1]
  const gap = 1.5
  const w = (size - gap * (cols - 1)) / cols
  const h = (size - gap * (rows - 1)) / rows
  const rects: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rects.push({ x: c * (w + gap), y: r * (h + gap) })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects.map((rect, i) => (
        <rect key={i} x={rect.x} y={rect.y} width={w} height={h} rx="1"
          fill="rgba(0,229,255,0.55)" />
      ))}
    </svg>
  )
}
