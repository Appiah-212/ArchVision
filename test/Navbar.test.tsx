import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Navbar from '../components/Navbar';
import { useOutletContext } from 'react-router';

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>(
      'react-router',
    );

  return {
    ...actual,
    useOutletContext: vi.fn(),
  };
});

const mockedUseOutletContext = vi.mocked(useOutletContext);

describe('Navbar authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Log In and calls signIn when unauthenticated', async () => {
    const signIn = vi.fn().mockResolvedValue(true);

    mockedUseOutletContext.mockReturnValue({
      isSignedIn: false,
      userName: null,
      userId: null,
      refreshAuth: vi.fn(),
      signIn,
      signOut: vi.fn(),
    });

    render(<Navbar />);

    fireEvent.click(
      screen.getByRole('button', {
        name: /log in/i,
      }),
    );

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the username and calls signOut when authenticated', async () => {
    const signOut = vi.fn().mockResolvedValue(false);

    mockedUseOutletContext.mockReturnValue({
      isSignedIn: true,
      userName: 'Thomas',
      userId: 'user-123',
      refreshAuth: vi.fn(),
      signIn: vi.fn(),
      signOut,
    });

    render(<Navbar />);

    expect(
      screen.getByText('Hi, Thomas'),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /log out/i,
      }),
    );

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});