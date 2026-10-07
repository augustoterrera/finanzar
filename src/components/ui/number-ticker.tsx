"use client"

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react"
import { useInView, useMotionValue, useSpring } from "framer-motion"

import { cn } from "@/lib/utils"

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  prefix?: string
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  prefix = "",
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === "down" ? value : startValue)
  const springValue = useSpring(motionValue, {
    damping: 50,
    stiffness: 90,
  })
  const isInView = useInView(ref, { once: true, margin: "0px" })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value)
      }, delay * 1000)
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer)
      }
    }
  }, [motionValue, isInView, delay, value, direction, startValue])

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          const isNegative = latest < 0
          const absVal = Math.abs(latest)
          const formatted = Intl.NumberFormat("es-AR", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(absVal.toFixed(decimalPlaces)))

          ref.current.textContent = `${isNegative ? "-" : ""}${prefix}${formatted}`
        }
      }),
    [springValue, decimalPlaces, prefix]
  )

  const initialVal = direction === "down" ? value : startValue
  const isNeg = initialVal < 0
  const initialFormatted = Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(Math.abs(initialVal).toFixed(decimalPlaces)))

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-normal tabular-nums",
        className
      )}
      {...props}
    >
      {isNeg ? "-" : ""}{prefix}{initialFormatted}
    </span>
  )
}
