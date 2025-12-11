import type { SectionType } from './types'

// Shared section styling for both DocumentView and FormatView.
// Keep in sync to avoid UX inconsistencies.
export const SECTION_STYLES: Partial<
  Record<SectionType, { bg: string; text: string; border: string; pill: string }>
> = {
  HPI: {
    bg: 'bg-rose-100/50 dark:bg-rose-900/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-300 dark:border-rose-700',
    pill: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-300'
  },
  PMH: {
    bg: 'bg-amber-100/50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700',
    pill: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300'
  },
  PSH: {
    bg: 'bg-orange-100/50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
    pill: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300'
  },
  MEDS: {
    bg: 'bg-emerald-100/50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-700',
    pill: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-300'
  },
  ALLERGIES: {
    bg: 'bg-red-100/50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    pill: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300'
  },
  ROS: {
    bg: 'bg-blue-100/50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
    pill: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300'
  },
  PE: {
    bg: 'bg-indigo-100/50 dark:bg-indigo-900/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    border: 'border-indigo-300 dark:border-indigo-700',
    pill: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300'
  },
  VITALS: {
    bg: 'bg-teal-100/50 dark:bg-teal-900/20',
    text: 'text-teal-700 dark:text-teal-300',
    border: 'border-teal-300 dark:border-teal-700',
    pill: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-300'
  },
  LABS: {
    bg: 'bg-cyan-100/50 dark:bg-cyan-900/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-300 dark:border-cyan-700',
    pill: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-300'
  },
  IMAGING: {
    bg: 'bg-purple-100/50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
    pill: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300'
  },
  ASSESSMENT: {
    bg: 'bg-violet-100/50 dark:bg-violet-900/20',
    text: 'text-violet-700 dark:text-violet-300',
    border: 'border-violet-300 dark:border-violet-700',
    pill: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-300'
  },
  PLAN: {
    bg: 'bg-green-100/50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
    pill: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300'
  },
  COURSE: {
    bg: 'bg-pink-100/50 dark:bg-pink-900/20',
    text: 'text-pink-700 dark:text-pink-300',
    border: 'border-pink-300 dark:border-pink-700',
    pill: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-300'
  },
  SOCIAL: {
    bg: 'bg-yellow-100/50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-300 dark:border-yellow-700',
    pill: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300'
  },
  FAMILY: {
    bg: 'bg-lime-100/50 dark:bg-lime-900/20',
    text: 'text-lime-700 dark:text-lime-300',
    border: 'border-lime-300 dark:border-lime-700',
    pill: 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 border-lime-300'
  }
}

export const DEFAULT_SECTION_STYLE = {
  bg: 'bg-maple-100/50 dark:bg-maple-700/50',
  text: 'text-maple-600 dark:text-maple-300',
  border: 'border-maple-300 dark:border-maple-600',
  pill: 'bg-maple-100 dark:bg-maple-700 text-maple-600 dark:text-maple-300 border-maple-300'
}

