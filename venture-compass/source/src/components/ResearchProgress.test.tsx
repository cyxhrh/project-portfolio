import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { categoryScenes, demoResearchInput } from '../app/mockData';
import { ResearchProgress } from './ResearchProgress';

function makeProps(status: 'loading' | 'insufficient' | 'error' = 'loading') {
  return {
    locale: 'zh' as const,
    status,
    category: categoryScenes[0],
    researchInput: demoResearchInput,
    onComplete: vi.fn(),
    onBack: vi.fn(),
    onRetry: vi.fn(),
  };
}

test('moves through every staged analysis and completes after the final stage', () => {
  vi.useFakeTimers();
  const props = makeProps();

  render(<ResearchProgress {...props} />);

  expect(screen.getByText('演示说明：以下步骤为非实时的示意流程，未执行实时市场研究。')).toBeInTheDocument();
  expect(screen.getByText('演示步骤：分析趋势')).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByRole('status')).toHaveTextContent('当前进度：演示步骤：分析趋势');

  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByText('演示步骤：分析竞品')).toHaveAttribute('aria-current', 'step');
  expect(screen.getByText('演示步骤：分析趋势')).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('status')).toHaveTextContent('当前进度：演示步骤：分析竞品');

  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByText('演示步骤：评估预算适配')).toHaveAttribute('aria-current', 'step');

  act(() => vi.advanceTimersByTime(800));
  expect(screen.getByText('演示步骤：整理示例证据')).toHaveAttribute('aria-current', 'step');

  act(() => vi.advanceTimersByTime(800));

  expect(props.onComplete).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

test('clears pending completion when the progress view unmounts', () => {
  vi.useFakeTimers();
  const props = makeProps();
  const { unmount } = render(<ResearchProgress {...props} />);

  unmount();
  act(() => vi.advanceTimersByTime(3200));

  expect(props.onComplete).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test('clears pending completion when progress switches to a recovery status', () => {
  vi.useFakeTimers();
  const props = makeProps();
  const { rerender } = render(<ResearchProgress {...props} />);

  rerender(<ResearchProgress {...props} status="insufficient" />);
  act(() => vi.advanceTimersByTime(3200));

  expect(props.onComplete).not.toHaveBeenCalled();
  vi.useRealTimers();
});

test.each([
  ['insufficient', '当前示例覆盖不足，请修改条件后重试。'],
  ['error', '示例研究暂时无法完成，请重新研究。'],
] as const)('offers back and retry actions for the %s recovery state', (status, message) => {
  const props = makeProps(status);
  render(<ResearchProgress {...props} />);

  expect(screen.getByRole('heading', { name: message })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '返回修改条件' }));
  fireEvent.click(screen.getByRole('button', { name: '重新研究' }));

  expect(props.onBack).toHaveBeenCalledTimes(1);
  expect(props.onRetry).toHaveBeenCalledTimes(1);
});
