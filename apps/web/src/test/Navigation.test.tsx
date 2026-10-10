import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Navigation } from '../components/layout/Navigation';

describe('Navigation component (§W1)', () => {
  it('renders all key navigation links', () => {
    render(
      <BrowserRouter>
        <Navigation />
      </BrowserRouter>,
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText('New Story Intake')).toBeInTheDocument();
    expect(screen.getByText('Approval Gate')).toBeInTheDocument();
    expect(screen.getByText('Validation & Healing')).toBeInTheDocument();
    expect(screen.getByText('Repository & Gates')).toBeInTheDocument();
  });
});
