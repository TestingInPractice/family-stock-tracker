import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('рендерит заглушку', () => {
    render(<App />);
    expect(screen.getByText('Трекер запасов')).toBeInTheDocument();
  });
});