import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

const items = [
  { id: 'a', label: 'Bold', onClick: vi.fn(), pressed: true },
  { id: 'b', label: 'Italic', onClick: vi.fn() },
  { id: 'c', label: 'Disabled', onClick: vi.fn(), disabled: true },
  { id: 'd', label: 'Quote', onClick: vi.fn() },
];

describe('Toolbar', () => {
  it('is a single tab stop with arrow-key navigation that skips disabled items', async () => {
    render(
      <>
        <Toolbar label="Formatting" items={items} />
        <button>after</button>
      </>,
    );
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Italic' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Quote' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Quote' })).toHaveFocus();

    // Tab leaves the toolbar in one step.
    await user.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
  });

  it('exposes toggle state', () => {
    render(<Toolbar label="Formatting" items={items} />);
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });
});
