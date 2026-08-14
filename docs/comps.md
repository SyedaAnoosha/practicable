"use client";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type TypewriterSequence = {
  text: string;
  deleteAfter?: boolean;
  pauseAfter?: number;
};

type TypewriterTitleProps = {
  sequences?: TypewriterSequence[];
  typingSpeed?: number;
  startDelay?: number;
  autoLoop?: boolean;
  loopDelay?: number;
  deleteSpeed?: number;
  pauseBeforeDelete?: number;
  naturalVariance?: boolean;
};

const DEFAULT_SEQUENCES: TypewriterSequence[] = [
  { text: "Typewriter", deleteAfter: true },
  { text: "Multiple Words", deleteAfter: true },
  { text: "Auto Loop", deleteAfter: false },
];

export default function TypewriterTitle({
  sequences = DEFAULT_SEQUENCES,
  typingSpeed = 50,
  startDelay = 200,
  autoLoop = true,
  loopDelay = 1000,
  deleteSpeed = 30,
  pauseBeforeDelete = 1000,
  naturalVariance = true,
}: TypewriterTitleProps) {
  const [displayText, setDisplayText] = useState("");
  const sequenceIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize with the sequences provided
  const sequencesRef = useRef(sequences);
  useEffect(() => {
    sequencesRef.current = sequences;
  }, [sequences]);

  useEffect(() => {
    const getTypingDelay = () => {
      if (!naturalVariance) {
        return typingSpeed;
      }

      // More natural human typing pattern
      const random = Math.random();

      // 10% chance of a longer pause (thinking/hesitation)
      if (random < 0.1) {
        return typingSpeed * 2;
      }

      // 10% chance of a burst (fast typing)
      if (random > 0.9) {
        return typingSpeed * 0.5;
      }

      // Standard variance (+/- 40%)
      const variance = 0.4;
      const min = typingSpeed * (1 - variance);
      const max = typingSpeed * (1 + variance);
      return Math.random() * (max - min) + min;
    };

    const runTypewriter = () => {
      const currentSequence = sequencesRef.current[sequenceIndexRef.current];
      if (!currentSequence) {
        return;
      }

      if (isDeletingRef.current) {
        if (charIndexRef.current > 0) {
          charIndexRef.current -= 1;
          setDisplayText(currentSequence.text.slice(0, charIndexRef.current));
          timeoutRef.current = setTimeout(runTypewriter, deleteSpeed);
        } else {
          isDeletingRef.current = false;
          const isLastSequence =
            sequenceIndexRef.current === sequencesRef.current.length - 1;

          if (isLastSequence && autoLoop) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current = 0;
              runTypewriter();
            }, loopDelay);
          } else if (!isLastSequence) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current += 1;
              runTypewriter();
            }, 100); // Quick transition to next word
          }
        }
      } else if (charIndexRef.current < currentSequence.text.length) {
        charIndexRef.current += 1;
        setDisplayText(currentSequence.text.slice(0, charIndexRef.current));
        timeoutRef.current = setTimeout(runTypewriter, getTypingDelay());
      } else {
        const pauseDuration = currentSequence.pauseAfter ?? pauseBeforeDelete;

        if (currentSequence.deleteAfter) {
          timeoutRef.current = setTimeout(() => {
            isDeletingRef.current = true;
            runTypewriter();
          }, pauseDuration);
        } else {
          const isLastSequence =
            sequenceIndexRef.current === sequencesRef.current.length - 1;

          if (isLastSequence && autoLoop) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current = 0;
              charIndexRef.current = 0;
              setDisplayText("");
              runTypewriter();
            }, loopDelay);
          } else if (!isLastSequence) {
            timeoutRef.current = setTimeout(() => {
              sequenceIndexRef.current += 1;
              charIndexRef.current = 0;
              setDisplayText("");
              runTypewriter();
            }, pauseDuration);
          }
        }
      }
    };

    // Start the loop
    timeoutRef.current = setTimeout(runTypewriter, startDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    // Only restart effect if timing configs change.
    // We use sequencesRef for content to avoid restarting on array reference change.
    typingSpeed,
    deleteSpeed,
    pauseBeforeDelete,
    autoLoop,
    loopDelay,
    startDelay,
    naturalVariance,
  ]);

  return (
    <div className="relative mx-auto w-full max-w-4xl py-24">
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <motion.div
          animate={{ opacity: 1 }}
          className="flex items-center gap-1 font-mono text-4xl text-black tracking-tight md:text-6xl dark:text-white"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block min-h-[1.2em] min-w-[0.5em]">
            {displayText}
          </span>
          <motion.span
            animate={{
              opacity: [1, 1, 0, 0],
            }}
            className="inline-block h-[1em] w-[3px] bg-black dark:bg-white"
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              ease: "linear",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}



import type { LucideIcon } from 'lucide-react';
import {
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/base-ui/breadcrumb';

type BreadcrumbSegment =
  | {
      label: string;
      href: string;
      icon: LucideIcon;
      current?: false;
    }
  | {
      label: string;
      icon: LucideIcon;
      current: true;
      href?: never;
    };

const segments: readonly BreadcrumbSegment[] = [
  { label: 'Home', href: '#', icon: HomeIcon },
  { label: 'Reports', href: '#', icon: FolderIcon },
  { label: 'Revenue Summary', icon: FileTextIcon, current: true },
] as const;

const Breadcrumb3 = () => {
  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1.5 text-sm">
        {segments.map((segment, index) => {
          const Icon = segment.icon;

          return (
            <BreadcrumbItem key={segment.label}>
              {'href' in segment ? (
                <BreadcrumbLink
                  href={segment.href}
                  className="hover:text-foreground flex items-center gap-1.5 rounded-sm px-1 py-0.5"
                >
                  <Icon className="text-muted-foreground size-3.5" />
                  {index === 0 ? (
                    <span className="text-sm">Home</span>
                  ) : (
                    segment.label
                  )}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 font-medium">
                  <Icon className="text-foreground/80 size-3.5" />
                  {segment.label}
                </BreadcrumbPage>
              )}
              {index < segments.length - 1 ? (
                <BreadcrumbSeparator className="text-muted-foreground/70">
                  <ChevronRightIcon />
                </BreadcrumbSeparator>
              ) : null}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumb3;


'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, X } from 'lucide-react';

interface BreakdownItem {
  label: string;
  amount: number;
  color: string;
}

interface BudgetCardProps {
  month: string;
  totalBudget: number;
  spentAmount: number;
  breakdown: BreakdownItem[];
  onViewDetails?: () => void;
  onMonthChange?: (month: string) => void;
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const BudgetCard: React.FC<BudgetCardProps> = ({
  month: initialMonth,
  totalBudget,
  spentAmount,
  breakdown,
  onViewDetails,
  onMonthChange,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const spentPercentage = Math.round((spentAmount / totalBudget) * 100);
  const remainingAmount = totalBudget - spentAmount;

  const smoothTransition = { duration: 1.5, ease: [0.19, 1, 0.22, 1] } as const;
  const cornerClass = 'absolute w-5 h-5 border-black/20 dark:border-white/20';

  // Mock Transactions
  const transactions = [
    {
      id: 1,
      date: 'Jul 12',
      name: 'Whole Foods',
      category: 'Groceries',
      amount: 84.5,
    },
    {
      id: 2,
      date: 'Jul 10',
      name: 'Rent Payment',
      category: 'Rent',
      amount: 1600.0,
    },
    {
      id: 3,
      date: 'Jul 08',
      name: 'Chevron Gas',
      category: 'Other',
      amount: 52.3,
    },
    {
      id: 4,
      date: 'Jul 05',
      name: 'Starbucks',
      category: 'Other',
      amount: 12.45,
    },
    {
      id: 5,
      date: 'Jul 02',
      name: 'Apple Subscription',
      category: 'Other',
      amount: 9.99,
    },
  ];

  // Click outside logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMonthSelect = (m: string) => {
    setSelectedMonth(m);
    setIsDropdownOpen(false);
    if (onMonthChange) onMonthChange(m);
  };

  return (
    <div className="relative mx-auto w-full max-w-130">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
      >
        {/* Corner Borders */}
        <div
          className={`${cornerClass} top-0 left-0 z-40 border-t-[1.6px] border-l-[1.6px]`}
        />
        <div
          className={`${cornerClass} top-0 right-0 z-40 border-t-[1.6px] border-r-[1.6px]`}
        />
        <div
          className={`${cornerClass} bottom-0 left-0 z-40 border-b-[1.6px] border-l-[1.6px]`}
        />
        <div
          className={`${cornerClass} right-0 bottom-0 z-40 border-r-[1.6px] border-b-[1.6px]`}
        />

        <div className="relative w-full overflow-visible border-[1.6px] border-black/8 bg-white font-sans text-black shadow-sm dark:border-[#e3d4d4]/10 dark:bg-[#0B0B0B] dark:text-white dark:shadow-2xl">
          {/* Top Section */}
          <div className="p-6 pb-4 sm:p-8">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-sm font-normal text-zinc-500 sm:text-[18px] dark:text-[#686868]">
                Monthly Budget
              </p>

              {/* --- Month Dropdown --- */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex min-w-30 items-center justify-between gap-2 border-[1.6px] border-zinc-200 bg-transparent px-3 py-1 text-sm font-normal text-zinc-500 transition-colors hover:bg-zinc-50 sm:gap-4 sm:text-[18px] dark:border-[#1e1d1d] dark:text-[#686868] dark:hover:bg-[#1A1A1A]"
                >
                  {selectedMonth}
                  <motion.div animate={{ rotate: isDropdownOpen ? 180 : 0 }}>
                    <ChevronDown
                      size={16}
                      className="text-zinc-400 dark:text-[#7d7c7c]"
                    />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 5, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full right-0 z-100 w-48 overflow-hidden border-[1.6px] border-black/8 bg-white shadow-xl dark:border-[#1e1d1d] dark:bg-[#121212]"
                    >
                      <div className="custom-scrollbar max-h-60 overflow-y-auto py-1">
                        {months.map((m) => (
                          <button
                            key={m}
                            onClick={() => handleMonthSelect(m)}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                              selectedMonth === m
                                ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-white/5 dark:text-white'
                                : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-white/2'
                            }`}
                          >
                            {m}
                            {selectedMonth === m && (
                              <Check
                                size={14}
                                className="text-zinc-900 dark:text-white"
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <h2 className="mb-6 text-[40px] leading-none font-medium tracking-tight text-zinc-900 sm:mb-10 sm:text-[60px] dark:text-[#F4F4F4]">
              ${totalBudget.toLocaleString()}
            </h2>

            <div className="space-y-3">
              <p className="text-sm font-normal text-zinc-500 sm:text-[18px] dark:text-[#686868]">
                Monthly spending limit
              </p>
              <div className="h-2 w-full overflow-hidden bg-zinc-100 dark:bg-[#222222]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${spentPercentage}%` }}
                  transition={smoothTransition}
                  className="h-full bg-linear-to-r from-zinc-400 to-zinc-800 dark:from-[#424243] dark:to-white/90"
                />
              </div>
              <div className="flex items-end justify-between pt-1">
                <div className="space-y-1.5">
                  <span className="block text-[12px] font-normal text-zinc-400 capitalize sm:text-[14px] dark:text-[#7e7d7d]">
                    Spent
                  </span>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-[16px] font-normal text-zinc-600 sm:text-[20px] dark:text-[#B3B3B3]">
                      ${spentAmount.toLocaleString()}
                    </span>
                    <span className="border border-black/5 bg-gray-100 px-1.5 py-[1.75px] text-[12px] font-normal text-zinc-500 dark:border-white/10 dark:bg-black dark:bg-linear-to-t dark:from-[#010101]/10 dark:to-white/10 dark:text-[#f1f1f1]/40">
                      {spentPercentage}%
                    </span>
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <span className="block text-[14px] font-normal text-zinc-400 capitalize sm:text-[16px] dark:text-[#7e7d7d]">
                    Remaining
                  </span>
                  <span className="text-[16px] font-normal text-zinc-600 sm:text-[20px] dark:text-[#B3B3B3]">
                    ${remainingAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-black/5 dark:bg-white/5" />

          {/* Bottom Section  */}
          <div className="space-y-6 p-6 pt-7 sm:p-8">
            <div className="space-y-3">
              <p className="block text-[14px] font-normal text-zinc-400 capitalize sm:text-[16px] dark:text-[#7e7d7d]">
                Spending breakdown
              </p>
              <div className="flex h-2 gap-2">
                {breakdown.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ ...smoothTransition, delay: 0.5 + idx * 0.1 }}
                    className="h-full origin-left"
                    style={{ flex: item.amount, background: item.color }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {breakdown.map((item, idx) => (
                  <div className="flex flex-col gap-1" key={idx}>
                    <p className="block truncate text-[12px] font-normal text-zinc-400 capitalize sm:text-[14px] dark:text-[#7e7d7d]">
                      {item.label}
                    </p>
                    <p className="text-[14px] font-normal text-zinc-600 sm:text-[18px] dark:text-[#B3B3B3]">
                      ${item.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setIsDetailsOpen(true);
                if (onViewDetails) onViewDetails();
              }}
              className="w-full border-[1.6px] border-zinc-200 bg-transparent py-3 text-[14px] font-normal text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-[#1e1d1d]/90 dark:text-[#f1f1f1] dark:hover:bg-white/5"
            >
              View Details
            </button>
          </div>
        </div>
      </motion.div>

      {/* --- Details Modal --- */}
      <AnimatePresence>
        {isDetailsOpen && (
          <div className="absolute inset-0 z-100 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailsOpen(false)}
              className="absolute inset-0 bg-white/60 backdrop-blur-md dark:bg-black/80"
            />
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative flex max-h-[90%] w-full max-w-lg flex-col overflow-hidden border-[1.6px] border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0B0B0B]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-black/5 p-6 dark:border-white/5">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Budget Details
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Deep dive into your {selectedMonth} spending
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="rounded-full p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  <X size={20} className="text-zinc-500 dark:text-zinc-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="rounded-lg border border-black/5 bg-zinc-50 p-3 transition-colors sm:p-4 dark:border-white/5 dark:bg-white/2">
                    <p className="mb-1 truncate text-[9px] tracking-wide text-zinc-400 uppercase sm:text-[10px]">
                      Total Budget
                    </p>
                    <p className="text-lg leading-tight font-medium text-zinc-900 sm:text-xl dark:text-white">
                      ${totalBudget.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/5 bg-zinc-50 p-3 transition-colors sm:p-4 dark:border-white/5 dark:bg-white/2">
                    <p className="mb-1 truncate text-[9px] tracking-wide text-zinc-400 uppercase sm:text-[10px]">
                      Amount Spent
                    </p>
                    <p className="text-lg leading-tight font-medium text-zinc-600 sm:text-xl dark:text-zinc-300">
                      ${spentAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Category Breakdown (Detailed) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                    Category Breakdown
                  </h4>
                  <div className="space-y-4">
                    {breakdown.map((item, idx) => {
                      const percentage = Math.round(
                        (item.amount / spentAmount) * 100,
                      );
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium text-zinc-600 dark:text-zinc-300">
                              {item.label}
                            </span>
                            <span className="text-zinc-400">{percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className="h-full rounded-full"
                              style={{ background: item.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Transactions History */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
                    Recent Transactions
                  </h4>
                  <div className="divide-y divide-black/5 border-t border-black/5 dark:divide-white/5 dark:border-white/5">
                    {transactions.map((t) => (
                      <div
                        key={t.id}
                        className="group -mx-2 flex items-center justify-between gap-2 overflow-hidden rounded-md px-2 py-3 transition-colors hover:bg-zinc-50 sm:gap-4 dark:hover:bg-white/1"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-400 dark:bg-white/5">
                            {t.name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium tracking-tight text-zinc-900 uppercase dark:text-white">
                              {t.name}
                            </p>
                            <p className="truncate text-[10px] text-zinc-500">
                              {t.category} • {t.date}
                            </p>
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-sm font-medium text-zinc-900 dark:text-zinc-300">
                          -${t.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t border-black/5 p-6 dark:border-white/5">
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="w-full bg-zinc-900 py-3 font-medium text-white transition-transform active:scale-[0.98] dark:bg-white dark:text-black"
                >
                  Close Insights
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};