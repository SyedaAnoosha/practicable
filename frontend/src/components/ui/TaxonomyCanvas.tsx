import { useMemo } from 'react'
import { usePrefersReducedMotion } from '@/lib/motion'

/**
 * The hero graphic — 99 nodes in 5 domain clusters, gold connective lines, slow
 * ambient drift, parallax (REDESIGN_SUMMARY.md §6.3).
 *
 * This is the piece that makes the page unmistakably Practicable's rather than a
 * well-executed template. It must be **driven by the real API counts**, degrade to
 * a static SVG under reduced motion, and never render a number the database cannot
 * support.
 *
 * Design references:
 * - Utomic: 3D contour-line sculpture — the force we're borrowing
 * - Galilee: cards floating over a rich background — the register we're keeping
 * - Framer §1.3: ambient loop is the only continuously-moving thing, always background
 *
 * The canvas is purely decorative (`aria-hidden="true"`) — it carries no information
 * that isn't also in the headline, the TrustStrip, and the question cards below it.
 */

interface QuestionNode {
  id: string
  domain: string
  /** Deterministic pseudo-random [0,1] derived from the slug. */
  hash: number
}

interface ClusterLayout {
  domain: string
  label: string
  color: string
  cx: number
  cy: number
  nodes: Array<{ x: number; y: number; hash: number; id: string }>
}

/** Deterministic hash from a string — same input always gives the same [0,1] value. */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return (Math.abs(h) % 10000) / 10000
}

/** Golden-angle spiral: places n points in a circle with near-optimal spacing. */
function goldenSpiral(n: number, radius: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const r = radius * Math.sqrt((i + 0.5) / n)
    const theta = i * goldenAngle
    points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) })
  }
  return points
}

const DOMAIN_CONFIG = [
  { domain: 'Risk (Enterprise & op.)', label: 'Risk', token: '--domain-risk' },
  { domain: 'Cyber (Tech & security)', label: 'Cyber', token: '--domain-cyber' },
  { domain: 'Compliance (Regulatory)', label: 'Compliance', token: '--domain-compliance' },
  { domain: 'Resilience (Continuity)', label: 'Resilience', token: '--domain-resilience' },
  { domain: 'AI (Governance)', label: 'AI', token: '--domain-ai' },
] as const

/** Build cluster layouts from raw question data. */
function buildLayout(questions: QuestionNode[]): ClusterLayout[] {
  // Group by domain
  const grouped = new Map<string, QuestionNode[]>()
  for (const q of questions) {
    const arr = grouped.get(q.domain) ?? []
    arr.push(q)
    grouped.set(q.domain, arr)
  }

  // Pentagon arrangement: 5 clusters evenly spaced on a circle
  const R = 170 // cluster center radius from canvas center
  const clusterRadius = 52 // each cluster's node spread

  return DOMAIN_CONFIG.map((cfg, i) => {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2 // start from top
    const cx = R * Math.cos(angle)
    const cy = R * Math.sin(angle)

    const domainNodes = grouped.get(cfg.domain) ?? []
    const spiral = goldenSpiral(domainNodes.length, clusterRadius)

    return {
      domain: cfg.domain,
      label: cfg.label,
      color: `var(${cfg.token})`,
      cx,
      cy,
      nodes: domainNodes.map((q, j) => ({
        x: cx + spiral[j].x,
        y: cy + spiral[j].y,
        hash: q.hash,
        id: q.id,
      })),
    }
  })
}

/** Intra-cluster connections: connect each node to its 2 nearest neighbours. */
function intraConnections(clusters: ClusterLayout[]): Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = []
  for (const cluster of clusters) {
    for (let i = 0; i < cluster.nodes.length; i++) {
      const a = cluster.nodes[i]
      // Connect to next node in spiral order (creates the organic web pattern)
      if (i + 1 < cluster.nodes.length) {
        const b = cluster.nodes[i + 1]
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: cluster.color })
      }
      // Connect to the node ~1/3 around the spiral (creates cross-connections)
      const jump = Math.max(1, Math.floor(cluster.nodes.length / 3))
      const j = (i + jump) % cluster.nodes.length
      if (j !== i && j !== (i + 1) % cluster.nodes.length) {
        const b = cluster.nodes[j]
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: cluster.color })
      }
    }
  }
  return lines
}

/** Inter-cluster connections: one gold line between adjacent cluster centres. */
function interConnections(clusters: ClusterLayout[]): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  for (let i = 0; i < clusters.length; i++) {
    const a = clusters[i]
    const b = clusters[(i + 1) % clusters.length]
    lines.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy })
  }
  return lines
}

interface TaxonomyCanvasProps {
  questions: Array<{ id: string; domain: string; slug: string }> | undefined
  className?: string
}

export function TaxonomyCanvas({ questions, className }: TaxonomyCanvasProps) {
  const reduced = usePrefersReducedMotion()

  const clusters = useMemo(() => {
    if (!questions || questions.length === 0) return []
    const nodes: QuestionNode[] = questions.map((q) => ({
      id: q.id,
      domain: q.domain,
      hash: hashString(q.slug),
    }))
    return buildLayout(nodes)
  }, [questions])

  const intra = useMemo(() => intraConnections(clusters), [clusters])
  const inter = useMemo(() => interConnections(clusters), [clusters])

  // Total node count — never hardcoded, always from the data
  const totalNodes = questions?.length ?? 0

  if (clusters.length === 0 || totalNodes === 0) return null

  // Canvas viewBox: centered on origin, sized to fit the pentagon + cluster spread
  const viewBoxSize = 520
  const half = viewBoxSize / 2

  return (
    <div className={className} aria-hidden="true">
      {/* Ambient drift keyframes — registered @property so CSS can interpolate the
          custom properties. One keyframe, one style block, shared by all 99 nodes.
          Under prefers-reduced-motion the global theme.css rule collapses animation-
          duration to 0.01ms, freezing each node at its base position. */}
      {!reduced && (
        <style>{`
          @property --dx { syntax: '<number>'; inherits: false; initial-value: 0; }
          @property --dy { syntax: '<number>'; inherits: false; initial-value: 0; }
          @keyframes taxonomy-node-drift {
            0%, 100% { transform: translate(var(--dx), var(--dy)); }
            25% { transform: translate(calc(var(--dy) * -0.7), var(--dx)); }
            50% { transform: translate(calc(var(--dx) * -0.5), calc(var(--dy) * -0.8)); }
            75% { transform: translate(var(--dy), calc(var(--dx) * -0.6)); }
          }
        `}</style>
      )}

      <svg
        viewBox={`${-half} ${-half} ${viewBoxSize} ${viewBoxSize}`}
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Inter-cluster gold connections — behind everything */}
        <g opacity="0.12">
          {inter.map((line, i) => (
            <line
              key={`inter-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--gold)"
              strokeWidth="0.6"
            />
          ))}
        </g>

        {/* Intra-cluster connections — domain-tinted, low opacity */}
        <g opacity="0.15">
          {intra.map((line, i) => (
            <line
              key={`intra-${i}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.color}
              strokeWidth="0.4"
            />
          ))}
        </g>

        {/* Nodes — each drifts independently under ambient animation */}
        {clusters.map((cluster) =>
          cluster.nodes.map((node) => {
            // Deterministic drift: each node drifts in a unique small orbit
            // based on its hash. The orbit radius is ~4-6px at the SVG scale.
            const driftX = (node.hash - 0.5) * 10
            const driftY = ((node.hash * 7.3) % 1 - 0.5) * 10
            // Stagger the animation start so nodes don't all move in sync
            const delay = node.hash * -20

            return (
              <circle
                key={node.id}
                cx={node.x}
                cy={node.y}
                r={2}
                fill={cluster.color}
                opacity={0.5 + node.hash * 0.35}
                style={
                  reduced
                    ? undefined
                    : ({
                        '--dx': driftX,
                        '--dy': driftY,
                        animation: `taxonomy-node-drift ${16 + node.hash * 8}s ease-in-out ${delay}s infinite`,
                      } as React.CSSProperties)
                }
              />
            )
          })
        )}

        {/* Domain labels at cluster centres — muted, small, readable at desktop.
            Hidden on mobile where the clusters are too tight. */}
        {clusters.map((cluster) => (
          <text
            key={`label-${cluster.domain}`}
            x={cluster.cx}
            y={cluster.cy + 68}
            textAnchor="middle"
            fill="var(--stage-foreground)"
            opacity="0.3"
            fontSize="9"
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
            className="hidden sm:block"
          >
            {cluster.label.toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  )
}
