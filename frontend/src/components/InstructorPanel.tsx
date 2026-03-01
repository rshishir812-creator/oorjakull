import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ExpectedPose, FocusArea, Severity } from '../api/client'
import { POSE_REFERENCES } from '../poses/reference'
import HighlightOverlay from './HighlightOverlay'

type FitRect = {
  x: number
  y: number
  width: number
  height: number
}

function computeObjectContainRect(
  containerWidth: number,
  containerHeight: number,
  mediaWidth: number,
  mediaHeight: number
): FitRect {
  if (containerWidth <= 0 || containerHeight <= 0 || mediaWidth <= 0 || mediaHeight <= 0) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight }
  }

  const scale = Math.min(containerWidth / mediaWidth, containerHeight / mediaHeight)
  const width = mediaWidth * scale
  const height = mediaHeight * scale
  const x = (containerWidth - width) / 2
  const y = (containerHeight - height) / 2
  return { x, y, width, height }
}

export default memo(function InstructorPanel(props: {
  baseUrl: string
  expectedPose: ExpectedPose
  primaryFocusArea: FocusArea
  severity: Severity | null
  alignedPulseActive: boolean
  alignedPulseKey: number
}) {
  const ref = POSE_REFERENCES.find((p) => p.pose === props.expectedPose)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [fitRect, setFitRect] = useState<FitRect>({ x: 0, y: 0, width: 0, height: 0 })

  const mediaSrc = ref
    ? ref.kind === 'video'
      ? `${props.baseUrl}${ref.src}`
      : ref.src
    : ''

  const recomputeFitRect = useMemo(() => {
    return () => {
      const stage = stageRef.current
      if (!stage) return

      const cw = stage.clientWidth
      const ch = stage.clientHeight

      let mw = 0
      let mh = 0
      if (ref?.kind === 'video') {
        const v = videoRef.current
        mw = v?.videoWidth ?? 0
        mh = v?.videoHeight ?? 0
      } else {
        const img = imgRef.current
        mw = img?.naturalWidth ?? 0
        mh = img?.naturalHeight ?? 0
      }

      const rect = computeObjectContainRect(cw, ch, mw, mh)
      setFitRect(rect)
    }
  }, [ref?.kind])

  useEffect(() => {
    recomputeFitRect()

    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(() => recomputeFitRect())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [recomputeFitRect, mediaSrc])

  return (
    <div className="min-h-0 h-full rounded-2xl border border-white/10 bg-white/5 shadow-2xl shadow-black/30 backdrop-blur flex flex-col">
      <div className="flex items-start justify-between gap-4 p-3">
        <div>
          <div className="text-xl font-medium tracking-tight text-slate-50">{props.expectedPose}</div>
          <div className="mt-1 text-xs text-slate-300">Instructor reference</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
          Highlight: <span className="capitalize">{props.primaryFocusArea.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 pb-3">
        <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div ref={stageRef} className="relative h-full w-full">
            {ref?.kind === 'video' ? (
              <video
                ref={videoRef}
                src={mediaSrc}
                className="block h-full w-full select-none object-contain"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={recomputeFitRect}
              />
            ) : (
              <img
                ref={imgRef}
                src={mediaSrc}
                alt={`${props.expectedPose} reference`}
                className="block h-full w-full select-none object-contain"
                draggable={false}
                onLoad={recomputeFitRect}
              />
            )}

            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute"
                style={{ left: fitRect.x, top: fitRect.y, width: fitRect.width, height: fitRect.height }}
              >
                <div className="relative h-full w-full">
                  <HighlightOverlay focus={props.primaryFocusArea} severity={props.severity} />

                  <AnimatePresence>
                    {props.alignedPulseActive ? (
                      <motion.div
                        key={props.alignedPulseKey}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeInOut' }}
                        className="absolute inset-2 rounded-2xl ring-2 ring-emerald-300/20"
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3" />
      </div>
    </div>
  )
})
