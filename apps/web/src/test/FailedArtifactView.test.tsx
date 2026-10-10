import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FailedArtifactView } from '../components/validation/FailedArtifactView';

describe('FailedArtifactView component (§W4)', () => {
  it('renders temporary workspace files and code preview', async () => {
    await act(async () => {
      render(<FailedArtifactView specId="SPEC-LOGIN-001" report={null} />);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Temporary Workspace & Failed Artifact Inspector/i),
      ).toBeInTheDocument();
      expect(screen.getByText('playwright.config.ts')).toBeInTheDocument();
    });

    // Clean workspace button exists
    expect(screen.getByRole('button', { name: /clean workspace/i })).toBeInTheDocument();
  });
});
