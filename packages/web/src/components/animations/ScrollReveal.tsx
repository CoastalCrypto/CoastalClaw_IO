/**
 * ScrollReveal — GSAP scroll-triggered entrance animation
 *
 * Wraps any children. When the element enters the viewport it fades
 * and slides in from the specified direction.
 *
 * Usage:
 *   <ScrollReveal from="bottom">
 *     <FeatureCard />
 *   </ScrollReveal>
 *
 *   <ScrollReveal from="left" delay={0.2}>
 *     <StatBlock />
 *   </ScrollReveal>
 */

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ReactNode } from 'react'

gsap.registerPlugin(ScrollTrigger)

interface ScrollRevealProps {
  children: ReactNode
  from?: 'bottom' | 'top' | 'left' | 'right'
  delay?: number
  duration?: number
  distance?: number
  className?: string
}

const DIRECTION_MAP = {
  bottom: { y: 40,  x: 0   },
  top:    { y: -40, x: 0   },
  left:   { x: -50, y: 0   },
  right:  { x: 50,  y: 0   },
}

export function ScrollReveal({
  children,
  from = 'bottom',
  delay = 0,
  duration = 0.7,
  distance,
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null!)

  useEffect(() => {
    const dir = DIRECTION_MAP[from]
    const start = distance
      ? from === 'bottom' || from === 'top'
        ? { y: from === 'bottom' ? distance : -distance, x: 0 }
        : { x: from === 'left' ? -distance : distance, y: 0 }
      : dir

    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        ...start,
        opacity: 0,
        duration,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      })
    })

    return () => ctx.revert()
  }, [from, delay, duration, distance])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

// ─── Stagger helper: animate a list of children with offset delays ────────────
export function StaggerReveal({
  children,
  stagger = 0.12,
  from = 'bottom',
  className,
}: {
  children: ReactNode[]
  stagger?: number
  from?: ScrollRevealProps['from']
  className?: string
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal key={i} from={from} delay={i * stagger}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
