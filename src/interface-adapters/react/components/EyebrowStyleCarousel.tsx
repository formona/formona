"use client";

import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { BRAND_COLORS } from '../../../constants';
import type { EyebrowStyle } from '../../../types';
import { cn } from '../utils';

interface EyebrowStyleCarouselProps {
  styles: EyebrowStyle[];
  selectedStyle: EyebrowStyle | null;
  onSelectStyle: (style: EyebrowStyle) => void;
  ariaLabel?: string;
  className?: string;
}

export function EyebrowStyleCarousel({
  styles,
  selectedStyle,
  onSelectStyle,
  ariaLabel = '눈썹 스타일 선택',
  className,
}: EyebrowStyleCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const frameRef = useRef<number | null>(null);
  const selectedStyleId = selectedStyle?.id;

  useEffect(() => {
    if (!selectedStyleId) return;

    const selectedCard = cardRefs.current[selectedStyleId];
    if (typeof selectedCard?.scrollIntoView === 'function') {
      selectedCard.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedStyleId]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const updateSelectedFromScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const scrollerBounds = scroller.getBoundingClientRect();
    const scrollerCenter = scrollerBounds.left + scrollerBounds.width / 2;
    let closestStyleId: string | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    styles.forEach((style) => {
      const card = cardRefs.current[style.id];
      if (!card) return;

      const cardBounds = card.getBoundingClientRect();
      const cardCenter = cardBounds.left + cardBounds.width / 2;
      const distance = Math.abs(cardCenter - scrollerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestStyleId = style.id;
      }
    });

    if (closestStyleId && closestStyleId !== selectedStyleId) {
      const nextStyle = styles.find((style) => style.id === closestStyleId);
      if (nextStyle) onSelectStyle(nextStyle);
    }
  }, [onSelectStyle, selectedStyleId, styles]);

  const handleScroll = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(updateSelectedFromScroll);
  }, [updateSelectedFromScroll]);

  if (styles.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className={cn("overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth", className)}
      aria-label={ariaLabel}
    >
      <div
        className="flex gap-4 py-2"
        style={{ paddingInline: 'calc((100% - min(280px, 76vw)) / 2)' }}
      >
        {styles.map((style) => {
          const selected = selectedStyleId === style.id;

          return (
            <motion.button
              key={style.id}
              ref={(node) => {
                cardRefs.current[style.id] = node;
              }}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectStyle(style)}
              className={cn(
                "shrink-0 snap-center rounded-2xl border bg-white p-5 text-left transition-all duration-300",
                "shadow-[0_10px_28px_rgba(79,44,29,0.08)]",
                selected
                  ? "border-main-brown opacity-100 shadow-[0_14px_34px_rgba(79,44,29,0.14)]"
                  : "border-main-brown/10 opacity-55"
              )}
              style={{ width: 'min(280px, 76vw)' }}
              aria-pressed={selected}
              aria-label={`${style.name} 선택`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-20 flex-1 items-center justify-center rounded-xl border border-main-brown/10 bg-main-brown/[0.03]">
                  <svg width="150" height="56" viewBox="0 0 150 56" aria-hidden="true">
                    <path
                      d={style.path}
                      fill="none"
                      stroke={selected ? BRAND_COLORS.brown : BRAND_COLORS.gray}
                      strokeWidth="8"
                      strokeLinecap="round"
                      transform="translate(22 8) scale(1.05)"
                    />
                  </svg>
                </div>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    selected
                      ? "border-main-brown bg-main-brown text-white"
                      : "border-main-brown/15 bg-white text-transparent"
                  )}
                  aria-hidden="true"
                >
                  <Check size={15} />
                </span>
              </div>
              <h4 className="mt-4 text-[17px] font-bold leading-tight text-main-brown">{style.name}</h4>
              <p className="mt-2 text-[13px] leading-relaxed text-sub-gray">{style.description}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
