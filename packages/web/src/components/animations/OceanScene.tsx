/**
 * OceanScene — Three.js animated ocean wave background
 *
 * A full-viewport 3D wave mesh with the Coastal.AI colour palette.
 * Drop onto any page as a background layer behind content.
 *
 * Usage:
 *   import { OceanScene } from './animations/OceanScene'
 *   <div style={{ position: 'relative' }}>
 *     <OceanScene />
 *     <YourContent />
 *   </div>
 */

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

// ─── Particle field that forms ocean surface ──────────────────────────────────
function OceanParticles() {
  const ref = useRef<THREE.Points>(null!)

  // Generate a flat grid of particles
  const [positions, count] = useMemo(() => {
    const ROWS = 60, COLS = 60
    const total = ROWS * COLS
    const pos = new Float32Array(total * 3)
    let i = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        pos[i++] = (c / COLS - 0.5) * 14   // x
        pos[i++] = 0                         // y — animated per frame
        pos[i++] = (r / ROWS - 0.5) * 14   // z
      }
    }
    return [pos, total]
  }, [])

  const posRef = useRef(positions.slice())

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = posRef.current
    let i = 0
    const ROWS = 60, COLS = 60
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = p[i]     // original x
        const z = p[i + 2] // original z
        p[i + 1] = Math.sin(x * 1.2 + t * 1.1) * 0.25
                 + Math.sin(z * 0.9 + t * 0.8) * 0.2
                 + Math.sin((x + z) * 0.6 + t * 1.4) * 0.15
        i += 3
      }
    }
    if (ref.current) {
      ref.current.geometry.attributes.position.array.set(p)
      ref.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <Points ref={ref} positions={positions} limit={count}>
      <PointMaterial
        transparent
        color="#00e5ff"
        size={0.045}
        sizeAttenuation
        depthWrite={false}
        opacity={0.7}
      />
    </Points>
  )
}

// ─── Slow camera drift ────────────────────────────────────────────────────────
function CameraDrift() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime() * 0.15
    camera.position.x = Math.sin(t) * 0.6
    camera.position.y = 2.5 + Math.sin(t * 0.7) * 0.3
    camera.lookAt(0, 0, 0)
  })
  return null
}

// ─── Public component ─────────────────────────────────────────────────────────
export function OceanScene({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #050a0f 0%, #0a1628 60%, #004e70 100%)',
        zIndex: 0,
      }}
    >
      <Canvas camera={{ position: [0, 2.5, 6], fov: 60 }}>
        <CameraDrift />
        <OceanParticles />
        <ambientLight intensity={0.3} color="#00b4d8" />
        <pointLight position={[0, 4, 2]} intensity={1.2} color="#00e5ff" />
      </Canvas>
    </div>
  )
}
