import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { OpeningExperience } from './OpeningExperience';

describe('OpeningExperience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => vi.useRealTimers());

  test('shows the approved wordmark and Chinese value statement', () => {
    render(<OpeningExperience onComplete={vi.fn()} />);
    expect(screen.getByText('Venture Compass')).toBeInTheDocument();
    expect(screen.getByText('用数据，找到值得验证的跨境商品机会')).toBeInTheDocument();
  });

  test.each([
    ['pointer', () => fireEvent.pointerDown(screen.getByRole('button'))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('completes immediately on %s', (_, trigger) => {
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    trigger();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('completes on native keyboard activation', async () => {
    const onComplete = vi.fn();
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<OpeningExperience onComplete={onComplete} />);
    const opening = screen.getByRole('button');
    opening.focus();

    await user.keyboard('{Enter}');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('completes after the 3.7 second normal timeline', () => {
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    vi.advanceTimersByTime(3699);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('uses the 0.6 second reduced-motion duration', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    vi.advanceTimersByTime(599);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
