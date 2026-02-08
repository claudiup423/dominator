'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { sessions } from '@/lib/api';
import { Card, GlowCard, HUDPanel } from '@/components/ui/Card';
import { DifficultyBadge, SectionHeader, Badge } from '@/components/ui/Badge';
import { cn, difficultyColor } from '@/lib/utils';
import { Dumbbell, Search, Star, Clock, Play, ArrowRight, Filter, Flame, Target, Shield, TrendingUp, Swords, Zap } from 'lucide-react';
import type { TrainingSession } from '@/types';

interface Drill {
  id: string;
  name: string;
  desc: string;
  mode: string;
  difficulty: string;
  duration_min: number;
  category: 'fundamentals' | 'advanced' | 'situational' | 'warmup';
  focus: string[];
  emoji: string;
  popular?: boolean;
}

const DRILLS: Drill[] = [
  // Warmup
  { id: 'warmup-basic', name: 'Quick Warm-Up', desc: 'Light touches, basic saves, get your fingers loose.', mode: 'defense', difficulty: 'bronze', duration_min: 3, category: 'warmup', focus: ['Reaction Time', 'Ball Tracking'], emoji: '🔥' },
  { id: 'warmup-aerial', name: 'Aerial Warm-Up', desc: 'Low aerials, fast reads, build your air confidence.', mode: 'shooting', difficulty: 'silver', duration_min: 5, category: 'warmup', focus: ['Aerials', 'Timing'], emoji: '🚀' },

  // Fundamentals
  { id: 'shadow-defense', name: 'Shadow Defense', desc: 'Track the attacker without committing. Stay between ball and net.', mode: 'defense', difficulty: 'gold', duration_min: 10, category: 'fundamentals', focus: ['Positioning', 'Patience', 'Recovery'], emoji: '👤', popular: true },
  { id: 'backboard-clears', name: 'Backboard Clears', desc: 'Read the bounce off your backboard and clear it confidently.', mode: 'defense', difficulty: 'plat', duration_min: 8, category: 'fundamentals', focus: ['Wall Reads', 'Clearing', 'Boost Management'], emoji: '🧱' },
  { id: 'power-shots', name: 'Power Shots', desc: 'Hit the ball hard and accurate. Focus on nose-to-ball contact.', mode: 'shooting', difficulty: 'gold', duration_min: 10, category: 'fundamentals', focus: ['Shot Power', 'Accuracy', 'Flip Timing'], emoji: '💥', popular: true },
  { id: 'ground-dribbles', name: 'Ground Dribbles', desc: 'Keep the ball on your car roof through obstacle courses.', mode: 'possession', difficulty: 'plat', duration_min: 12, category: 'fundamentals', focus: ['Ball Control', 'Speed Management'], emoji: '⚽' },
  { id: 'kickoff-reads', name: 'Kickoff Mastery', desc: 'Perfect your kickoff timing and post-kickoff positioning.', mode: '50/50s', difficulty: 'gold', duration_min: 8, category: 'fundamentals', focus: ['Kickoff Speed', '50/50 Wins', 'Boost Grab'], emoji: '🏁', popular: true },

  // Advanced
  { id: 'air-dribbles', name: 'Air Dribbles', desc: 'Carry the ball through the air from wall or ground.', mode: 'possession', difficulty: 'diamond', duration_min: 15, category: 'advanced', focus: ['Aerial Control', 'Boost Efficiency'], emoji: '🌊' },
  { id: 'double-taps', name: 'Double Taps', desc: 'Hit the ball to backboard and score the rebound.', mode: 'shooting', difficulty: 'diamond', duration_min: 12, category: 'advanced', focus: ['Backboard Reads', 'Aerial Accuracy'], emoji: '✌️' },
  { id: 'flip-resets', name: 'Flip Resets', desc: 'Get your flip back from ball contact and use it for powerful shots.', mode: 'shooting', difficulty: 'champ', duration_min: 15, category: 'advanced', focus: ['Mechanics', 'Timing', 'Aerial Control'], emoji: '🔄' },
  { id: 'speed-recovery', name: 'Fast Recoveries', desc: 'Land perfectly and maintain momentum after every challenge.', mode: 'defense', difficulty: 'diamond', duration_min: 10, category: 'advanced', focus: ['Recovery Speed', 'Wavedash', 'Boost Pathing'], emoji: '⚡' },

  // Situational
  { id: 'last-man-back', name: 'Last Man Back', desc: 'You are the final defender. Do NOT over-commit.', mode: 'defense', difficulty: 'plat', duration_min: 10, category: 'situational', focus: ['Discipline', 'Shadow', 'Challenge Timing'], emoji: '🛡️', popular: true },
  { id: 'boost-starve', name: 'Boost Starve', desc: 'Deny opponent boost while maintaining your own supply.', mode: 'possession', difficulty: 'diamond', duration_min: 10, category: 'situational', focus: ['Boost Management', 'Map Awareness'], emoji: '🧪' },
  { id: 'clutch-saves', name: 'Clutch Saves', desc: 'Open net? Scramble back and make the impossible save.', mode: 'defense', difficulty: 'champ', duration_min: 8, category: 'situational', focus: ['Recovery', 'Desperation Saves', 'Reads'], emoji: '🧤' },
  { id: 'counter-attack', name: 'Counter Attack', desc: 'Transition from defense to offense in 3 seconds or less.', mode: 'shooting', difficulty: 'plat', duration_min: 10, category: 'situational', focus: ['Speed', 'Boost Efficiency', 'Shot Selection'], emoji: '⚡' },
  { id: 'demo-plays', name: 'Demo Plays', desc: 'Incorporate strategic demolitions into your offense.', mode: '50/50s', difficulty: 'diamond', duration_min: 8, category: 'situational', focus: ['Demo Timing', 'Positioning', 'Awareness'], emoji: '💣' },
];

const CATEGORY_CONFIG = {
  warmup: { label: 'Warm-Up', emoji: '🔥', color: '#F59E0B', desc: 'Get loose before the real work' },
  fundamentals: { label: 'Fundamentals', emoji: '📚', color: '#3B82F6', desc: 'Core skills every player needs' },
  advanced: { label: 'Advanced', emoji: '🎯', color: '#A855F7', desc: 'Push your mechanical ceiling' },
  situational: { label: 'Situational', emoji: '🧠', color: '#22C55E', desc: 'Game-sense and decision-making' },
};

export default function DrillsPage() {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return DRILLS.filter(d => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (modeFilter !== 'all' && d.mode !== modeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q) || d.focus.some(f => f.toLowerCase().includes(q));
      }
      return true;
    });
  }, [categoryFilter, modeFilter, searchQuery]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startDrill = async (drill: Drill) => {
    try {
      const session = await sessions.start({
        mode: drill.mode,
        difficulty: drill.difficulty,
        opponent_style: 'passive',
      }) as TrainingSession;
      router.push(`/session/${session.id}`);
    } catch {}
  };

  const popular = DRILLS.filter(d => d.popular);
  const favorited = DRILLS.filter(d => favorites.has(d.id));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">Drill Library</h1>
        <p className="text-sm text-dom-muted mt-1">Curated training packs to sharpen every aspect of your game.</p>
      </div>

      {/* Popular / Favorites */}
      {favorited.length > 0 ? (
        <div className="space-y-3">
          <SectionHeader>⭐ Your Favorites</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            {favorited.map(d => (
              <MiniDrillCard key={d.id} drill={d} onStart={startDrill} isFav onToggleFav={toggleFavorite} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SectionHeader>🔥 Popular Drills</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            {popular.map(d => (
              <MiniDrillCard key={d.id} drill={d} onStart={startDrill} isFav={favorites.has(d.id)} onToggleFav={toggleFavorite} />
            ))}
          </div>
        </div>
      )}

      {/* Category Cards */}
      <div className="grid grid-cols-4 gap-3">
        {(['warmup', 'fundamentals', 'advanced', 'situational'] as const).map(cat => {
          const c = CATEGORY_CONFIG[cat];
          const count = DRILLS.filter(d => d.category === cat).length;
          const isActive = categoryFilter === cat;
          return (
            <Card
              key={cat}
              hover
              onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
              className={cn(
                'text-center cursor-pointer',
                isActive && 'border-dom-accent/40 shadow-glow-accent'
              )}
            >
              <div className="text-2xl mb-2">{c.emoji}</div>
              <div className="font-display font-bold text-dom-heading text-sm">{c.label}</div>
              <div className="text-[10px] text-dom-muted mt-0.5">{count} drills</div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-4 py-3 px-4">
        <Filter className="w-4 h-4 text-dom-muted" />

        <div className="flex gap-1">
          {[
            { value: 'all', label: 'All Modes' },
            { value: 'defense', label: '🛡️ Defense' },
            { value: 'shooting', label: '🎯 Shooting' },
            { value: 'possession', label: '⚽ Possession' },
            { value: '50/50s', label: '⚔️ 50/50s' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setModeFilter(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                modeFilter === opt.value
                  ? 'bg-dom-accent/10 text-dom-accent border border-dom-accent/20'
                  : 'text-dom-muted hover:text-dom-text hover:bg-dom-elevated'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dom-muted" />
          <input
            type="text"
            placeholder="Search drills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field !pl-9 !py-1.5 !text-xs w-52"
          />
        </div>
      </Card>

      {/* Drill Grid */}
      <div className="grid grid-cols-2 gap-4 stagger">
        {filtered.map(d => (
          <DrillCard
            key={d.id}
            drill={d}
            isFav={favorites.has(d.id)}
            onToggleFav={toggleFavorite}
            onStart={startDrill}
          />
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-2 py-12 text-center">
            <span className="text-3xl block mb-3">🔍</span>
            <div className="text-dom-muted">No drills match your filters.</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function DrillCard({ drill, isFav, onToggleFav, onStart }: {
  drill: Drill; isFav: boolean; onToggleFav: (id: string) => void; onStart: (d: Drill) => void;
}) {
  const catConfig = CATEGORY_CONFIG[drill.category];
  return (
    <Card className="animate-slide-up space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
            style={{ borderColor: `${catConfig.color}30`, background: `${catConfig.color}10` }}
          >
            {drill.emoji}
          </div>
          <div>
            <div className="font-display font-bold text-dom-heading">{drill.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <DifficultyBadge difficulty={drill.difficulty} />
              <span className="text-xs text-dom-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />{drill.duration_min} min
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(drill.id); }}
          className={cn('p-1.5 rounded-lg transition-colors', isFav ? 'text-dom-yellow' : 'text-dom-muted hover:text-dom-yellow')}
        >
          <Star className={cn('w-4 h-4', isFav && 'fill-current')} />
        </button>
      </div>

      <p className="text-sm text-dom-muted leading-relaxed">{drill.desc}</p>

      {/* Focus tags */}
      <div className="flex flex-wrap gap-1.5">
        {drill.focus.map(f => (
          <span key={f} className="text-[10px] px-2 py-0.5 rounded-md bg-dom-elevated text-dom-muted border border-dom-border font-medium">
            {f}
          </span>
        ))}
      </div>

      <button onClick={() => onStart(drill)} className="btn-primary w-full group">
        <Play className="w-4 h-4" />
        Start Drill
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
      </button>
    </Card>
  );
}

function MiniDrillCard({ drill, onStart, isFav, onToggleFav }: {
  drill: Drill; onStart: (d: Drill) => void; isFav: boolean; onToggleFav: (id: string) => void;
}) {
  return (
    <Card hover className="cursor-pointer" onClick={() => onStart(drill)}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{drill.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-dom-heading text-sm truncate">{drill.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <DifficultyBadge difficulty={drill.difficulty} />
            <span className="text-[10px] text-dom-muted">{drill.duration_min}m</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(drill.id); }}
          className={cn('text-dom-muted hover:text-dom-yellow', isFav && 'text-dom-yellow')}
        >
          <Star className={cn('w-3.5 h-3.5', isFav && 'fill-current')} />
        </button>
      </div>
    </Card>
  );
}
