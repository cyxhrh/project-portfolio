import { fireEvent, render, screen } from '@testing-library/react';
import './app.css';
import { App } from '../app/App';

function parseComputedColorChannels(color: string): [number, number, number] {
  const channel = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)%?)';
  const separator = '\\s*(?:,|\\s+)\\s*';
  const match = color.match(new RegExp(`^rgba?\\(\\s*${channel}${separator}${channel}${separator}${channel}`, 'i'));

  if (!match) throw new Error(`Unsupported computed color: ${color}`);

  return [match[1], match[2], match[3]].map((value) => {
    const number = Number.parseFloat(value);
    return Math.round(value.endsWith('%') ? number * 2.55 : number);
  }) as [number, number, number];
}

test('normalizes computed CSS color channels across browser serializations', () => {
  expect(parseComputedColorChannels('rgb(114, 205, 178)')).toEqual([114, 205, 178]);
  expect(parseComputedColorChannels('rgba(114 205 178 / 0.82)')).toEqual([114, 205, 178]);
  expect(parseComputedColorChannels('rgb(44.705882% 80.392157% 69.803922%)')).toEqual([114, 205, 178]);
});

test('renders the research conditions page after the opening is skipped', () => {
  const { container } = render(<App />);
  fireEvent.pointerDown(screen.getByRole('button', { name: '跳过开场并进入商机罗盘' }));

  expect(screen.getByRole('form', { name: '每一个想法，都值得走向世界。' })).toBeInTheDocument();
  expect(container.querySelector('.research-conditions')).not.toBeNull();
  expect(container.querySelector('.research-form')).not.toBeNull();
  expect(container.querySelector('.explore-visual')).toBeNull();
  expect(screen.queryByTestId('fixed-selection-frame')).not.toBeInTheDocument();
});
