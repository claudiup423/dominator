'use client';

import { cn, difficultyColor } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn('inline-flex bg-dom-elevated rounded-lg p-1 border border-dom-border', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150',
            value === opt.value
              ? 'bg-dom-surface text-dom-heading shadow-sm border border-dom-border'
              : 'text-dom-muted hover:text-dom-text'
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const DIFFICULTIES = ['bronze', 'silver', 'gold', 'plat', 'diamond', 'champ', 'demon'] as const;
const RANK_ICONS: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇',
  plat: '💎', diamond: '💠', champ: '🏆', demon: '👹',
};

interface DifficultySliderProps {
  value: string;
  onChange: (value: string) => void;
}

export function DifficultySlider({ value, onChange }: DifficultySliderProps) {
  const idx = DIFFICULTIES.indexOf(value as any);

  return (
    <div className="space-y-4">
      {/* Current rank display */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-dom-text">Bot Difficulty</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{RANK_ICONS[value] || '⚡'}</span>
          <span
            className="text-lg font-display font-black uppercase tracking-wider"
            style={{ color: difficultyColor(value) }}
          >
            {value}
          </span>
        </div>
      </div>

      {/* Rank selector */}
      <div className="relative pt-2 pb-4">
        {/* Track background */}
        <div className="absolute top-[26px] left-4 right-4 h-1 bg-dom-border rounded-full" />
        {/* Active track */}
        <div
          className="absolute top-[26px] left-4 h-1 rounded-full transition-all duration-200"
          style={{
            width: `${(idx / (DIFFICULTIES.length - 1)) * (100 - 8)}%`,
            background: `linear-gradient(90deg, ${difficultyColor(DIFFICULTIES[0])}, ${difficultyColor(value)})`,
          }}
        />

        <div className="relative flex justify-between px-1">
          {DIFFICULTIES.map((d, i) => {
            const isActive = i <= idx;
            const isCurrent = i === idx;
            const color = difficultyColor(d);
            return (
              <button
                key={d}
                onClick={() => onChange(d)}
                className="flex flex-col items-center gap-2 group relative"
              >
                {/* Glow for current */}
                {isCurrent && (
                  <div
                    className="absolute top-1 w-8 h-8 rounded-full blur-lg opacity-40"
                    style={{ background: color }}
                  />
                )}
                {/* Dot */}
                <div
                  className={cn(
                    'relative w-6 h-6 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
                    isCurrent && 'scale-125',
                    !isActive && 'opacity-30 scale-75',
                  )}
                  style={{
                    borderColor: color,
                    backgroundColor: isActive ? color : 'transparent',
                    boxShadow: isCurrent ? `0 0 16px ${color}60` : 'none',
                  }}
                >
                  {isCurrent && <span className="text-[8px]">{RANK_ICONS[d]}</span>}
                </div>
                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider transition-all duration-200',
                    isCurrent ? 'opacity-100' : isActive ? 'opacity-60' : 'opacity-30',
                  )}
                  style={{ color }}
                >
                  {d.length > 4 ? d.slice(0, 4) : d}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
