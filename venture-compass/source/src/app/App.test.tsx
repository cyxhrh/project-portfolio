import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { App } from './App';

vi.mock('react-globe.gl', () => ({
  default: ({ ringsData = [] }: { ringsData?: object[] }) => (
    <span data-testid="globe-ring-count">{ringsData.length}</span>
  ),
}));

function renderHome(onNavigate?: (url: string) => void) {
  render(<App onNavigate={onNavigate} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: '跳过开场并进入商机罗盘' }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('renders the idea-first homepage after the opening is skipped', () => {
  renderHome();

  expect(document.querySelector('.research-form')).toHaveClass('research-form--idea-home');
  expect(document.querySelector('.vc-language-switch')).toHaveClass('vc-visually-hidden');
  expect(document.querySelector('.research-form__column--left')).not.toBeInTheDocument();
  expect(document.querySelector('.research-form__column--right')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '每一个想法，都值得走向世界。' })).toBeVisible();
  expect(screen.getByLabelText('商业想法')).toHaveAttribute(
    'placeholder',
    '例如：为每天做饭洗碗的人解决水槽下收纳混乱',
  );
  expect(screen.getByText('写下你的商业想法，从这里开始。')).toBeVisible();
  expect(screen.getByLabelText('商业想法')).toHaveAccessibleDescription('写下你的商业想法，从这里开始。');
  const composer = screen.getByRole('group', { name: '写下你的商业想法，从这里开始。' });
  expect(within(composer).getByRole('textbox', { name: '商业想法' })).toBeVisible();
  expect(within(composer).getByRole('link', { name: '寻找商业机会' })).toHaveAttribute(
    'href',
    '/sinkside/index.html',
  );
  expect(screen.queryByLabelText('品类方向')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('目标国家')).not.toBeInTheDocument();
});

test('shows a three-second reasoning sequence before opening the Sinkside campaign', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  const onNavigate = vi.fn();
  renderHome(onNavigate);

  const submitLink = screen.getByRole('link', { name: '寻找商业机会' });
  const pageUnderlay = document.querySelector('.vc-shell-underlay');
  expect(submitLink).toHaveAttribute(
    'href',
    '/sinkside/index.html',
  );
  expect(pageUnderlay).not.toHaveAttribute('inert');
  fireEvent.click(submitLink);

  expect(onNavigate).not.toHaveBeenCalled();
  const transitionStatus = screen.getByRole('status', { name: 'Opportunity analysis' });
  expect(transitionStatus).toHaveTextContent('READING DAILY USE');
  expect(transitionStatus).toHaveFocus();
  expect(pageUnderlay).toHaveAttribute('inert');

  act(() => vi.advanceTimersByTime(900));
  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveTextContent('MAPPING THE SPACE');
  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveFocus();

  act(() => vi.advanceTimersByTime(1200));
  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveTextContent('MATCH FOUND');
  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveFocus();

  act(() => vi.advanceTimersByTime(899));
  expect(onNavigate).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(1));
  expect(onNavigate).toHaveBeenCalledWith(
    '/sinkside/index.html',
  );
  expect(screen.queryByRole('status', { name: 'Opportunity analysis' })).not.toBeInTheDocument();
  expect(pageUnderlay).not.toHaveAttribute('inert');
});

test('uses a brief static result for people who prefer reduced motion', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
  const onNavigate = vi.fn();
  renderHome(onNavigate);

  fireEvent.click(screen.getByRole('link', { name: '寻找商业机会' }));

  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveTextContent('MATCH FOUND');
  act(() => vi.advanceTimersByTime(249));
  expect(onNavigate).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onNavigate).toHaveBeenCalledWith('/sinkside/index.html');
});

test('keeps a clicked globe marker selected for its point ripple', async () => {
  const user = userEvent.setup();
  renderHome();
  const japan = await screen.findByRole('button', { name: '选择日本' });

  await user.click(japan);

  expect(japan).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '选择美国' })).toHaveAttribute('aria-pressed', 'false');
});

test('opens the Sinkside product campaign with Enter without adding a newline', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  const onNavigate = vi.fn();
  renderHome(onNavigate);
  const ideaInput = screen.getByLabelText('商业想法');
  const form = ideaInput.closest('form')!;

  fireEvent.change(ideaInput, { target: { value: '为每天做饭洗碗的人解决水槽下收纳混乱' } });
  fireEvent.keyDown(ideaInput, { key: 'Enter', code: 'Enter' });

  expect(ideaInput).toHaveValue('为每天做饭洗碗的人解决水槽下收纳混乱');
  expect(form).toHaveAttribute('target', '_self');
  expect(screen.getByRole('status', { name: 'Opportunity analysis' })).toHaveTextContent('READING DAILY USE');
  expect(onNavigate).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(3000));
  expect(onNavigate).toHaveBeenCalledWith(
    '/sinkside/index.html',
  );
});

test('keeps Shift+Enter available for a newline', async () => {
  const user = userEvent.setup();
  renderHome();
  const ideaInput = screen.getByLabelText('商业想法');

  await user.type(ideaInput, '第一行');
  await user.keyboard('{Shift>}{Enter}{/Shift}');

  expect(ideaInput).toHaveValue('第一行\n');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('shows the idea-first homepage when the opening timeline completes', () => {
  vi.useFakeTimers();
  render(<App />);

  act(() => vi.advanceTimersByTime(3700));

  expect(screen.getByRole('heading', { name: '每一个想法，都值得走向世界。' })).toBeInTheDocument();
  expect(screen.queryByTestId('fixed-selection-frame')).not.toBeInTheDocument();
});
