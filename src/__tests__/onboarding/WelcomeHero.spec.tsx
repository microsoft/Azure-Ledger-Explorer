/*
 * Copyright (c) Microsoft Corporation.
 * Licensed under the Apache License, Version 2.0.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WelcomeHero } from '../../components/onboarding/WelcomeHero';

// Mock useFileDrop because LoadSampleButton (rendered inside the hero) depends on it.
// We don't exercise the sample-load behaviour in this file — that's covered separately.
vi.mock('../../hooks/use-ccf-data', () => ({
  useFileDrop: () => ({
    handleFiles: vi.fn(),
    isUploading: false,
    uploadProgress: null,
  }),
}));

const renderHero = (onPathClick = vi.fn()) => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <WelcomeHero onPathClick={onPathClick} />
    </QueryClientProvider>
  );
  return { onPathClick };
};

describe('WelcomeHero', () => {
  it('renders the welcome title and the value-prop subtitle', () => {
    renderHero();
    expect(screen.getByRole('heading', { name: /welcome to ledger explorer/i })).toBeInTheDocument();
    expect(screen.getByText(/no data leaves your machine/i)).toBeInTheDocument();
  });

  it('renders the three import-path cards', () => {
    renderHero();
    expect(screen.getByRole('listitem', { name: /local files/i })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /azure confidential ledger/i })).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /signing transparency/i })).toBeInTheDocument();
  });

  it('fires onPathClick with "local" when the local-files card CTA is clicked', () => {
    const { onPathClick } = renderHero();
    fireEvent.click(screen.getByRole('button', { name: /upload files/i }));
    expect(onPathClick).toHaveBeenCalledWith('local');
  });

  it('fires onPathClick with "azure" when the azure card CTA is clicked', () => {
    const { onPathClick } = renderHero();
    fireEvent.click(screen.getByRole('button', { name: /connect with sas/i }));
    expect(onPathClick).toHaveBeenCalledWith('azure');
  });

  it('fires onPathClick with "mst" when the MST card CTA is clicked', () => {
    const { onPathClick } = renderHero();
    fireEvent.click(screen.getByRole('button', { name: /fetch from mst/i }));
    expect(onPathClick).toHaveBeenCalledWith('mst');
  });

  it('fires onPathClick when the entire card area is clicked (mouse-friendly)', () => {
    const { onPathClick } = renderHero();
    const card = screen.getByRole('listitem', { name: /local files/i });
    fireEvent.click(card);
    expect(onPathClick).toHaveBeenCalledWith('local');
  });

  it('does not fire onPathClick or duplicate when the inner CTA is clicked (no propagation double-fire)', () => {
    const { onPathClick } = renderHero();
    fireEvent.click(screen.getByRole('button', { name: /upload files/i }));
    // Exactly one invocation, even though the click target is inside the card.
    expect(onPathClick).toHaveBeenCalledTimes(1);
    expect(onPathClick).toHaveBeenCalledWith('local');
  });

  it('disables card CTAs and the sample button when disabled=true', () => {
    const onPathClick = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <WelcomeHero onPathClick={onPathClick} disabled />
      </QueryClientProvider>
    );
    expect(screen.getByRole('button', { name: /upload files/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /connect with sas/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /fetch from mst/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /load sample ledger/i })).toBeDisabled();

    // Clicking the disabled outer card should also be a no-op.
    fireEvent.click(screen.getByRole('listitem', { name: /local files/i }));
    expect(onPathClick).not.toHaveBeenCalled();
  });

  it('renders the "How it works" section with three numbered steps', () => {
    renderHero();
    const howList = screen.getByRole('list', { name: /how it works/i });
    expect(howList).toBeInTheDocument();
    // Each of the three steps is a listitem inside the strip.
    const steps = screen.getAllByRole('listitem').filter(el => howList.contains(el));
    expect(steps).toHaveLength(3);
  });

  it('renders the "Load sample ledger" CTA', () => {
    renderHero();
    expect(screen.getByRole('button', { name: /load sample ledger/i })).toBeInTheDocument();
  });
});
