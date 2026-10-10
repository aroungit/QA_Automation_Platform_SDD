import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from '../components/layout/Footer';

describe('Footer component (§W1)', () => {
  it('renders mandatory footer copyright "© 2026 Aroun AI labs"', async () => {
    await act(async () => {
      render(<Footer />);
    });

    const copyright = screen.getByText(/© 2026 Aroun AI labs/i);
    expect(copyright).toBeInTheDocument();
  });
});
