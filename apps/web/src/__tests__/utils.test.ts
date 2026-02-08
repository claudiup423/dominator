import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent, formatDate, formatDuration, statusColor, tagColor, difficultyColor } from '@/lib/utils';

describe('Utility functions', () => {
  it('formatNumber handles null', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });

  it('formatNumber formats correctly', () => {
    expect(formatNumber(1.234)).toBe('1.23');
    expect(formatNumber(1.234, 1)).toBe('1.2');
  });

  it('formatPercent formats correctly', () => {
    expect(formatPercent(0.723)).toBe('72.3%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formatDate handles null', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('formatDuration calculates correctly', () => {
    expect(formatDuration(null, null)).toBe('—');
    const start = '2024-01-01T00:00:00Z';
    const end = '2024-01-01T02:30:00Z';
    expect(formatDuration(start, end)).toBe('2h 30m');
  });

  it('statusColor returns correct classes', () => {
    expect(statusColor('completed')).toBe('text-dom-green');
    expect(statusColor('running')).toBe('text-dom-accent');
    expect(statusColor('failed')).toBe('text-dom-red');
  });

  it('tagColor returns correct classes', () => {
    expect(tagColor('stable')).toContain('text-dom-green');
    expect(tagColor('candidate')).toContain('text-dom-purple');
  });

  it('difficultyColor returns colors for all ranks', () => {
    const ranks = ['bronze', 'silver', 'gold', 'plat', 'diamond', 'champ', 'demon'];
    ranks.forEach(r => {
      expect(difficultyColor(r)).toBeTruthy();
      expect(difficultyColor(r)).not.toBe('#6B7280');
    });
  });
});
