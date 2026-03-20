interface AppSectionTabsProps {
  value: 'yoga' | 'breathwork'
  onChange: (value: 'yoga' | 'breathwork') => void
}

export default function AppSectionTabs({ value, onChange }: AppSectionTabsProps) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 p-0.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-1">
      <button
        type="button"
        onClick={() => onChange('yoga')}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 sm:px-4 sm:py-2 sm:text-sm ${
          value === 'yoga'
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        Yoga
      </button>
      <button
        type="button"
        onClick={() => onChange('breathwork')}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:px-4 sm:py-2 sm:text-sm ${
          value === 'breathwork'
            ? 'bg-teal-500 text-white shadow-sm'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        Breathwork
      </button>
    </div>
  )
}
