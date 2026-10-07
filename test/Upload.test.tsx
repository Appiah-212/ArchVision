import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import Upload from '../components/Upload';
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

describe('Upload component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseOutletContext.mockReturnValue({
      isSignedIn: true,
      userName: 'Thomas',
      userId: 'user-123',
      refreshAuth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it('disables file upload when the user is not signed in', () => {
    mockedUseOutletContext.mockReturnValue({
      isSignedIn: false,
      userName: null,
      userId: null,
      refreshAuth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    const { container } = render(<Upload />);

    const input =
      container.querySelector<HTMLInputElement>(
        'input[type="file"]',
      );

    expect(input).toBeDisabled();

    expect(
      screen.getByText(
        'Sign in or sign up with Puter to upload',
      ),
    ).toBeInTheDocument();
  });

  it('accepts a valid PNG floor plan', () => {
    const { container } = render(<Upload />);

    const input =
      container.querySelector<HTMLInputElement>(
        'input[type="file"]',
      )!;

    const file = new File(
      ['floor-plan'],
      'residence.png',
      { type: 'image/png' },
    );

    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(
      screen.getByText('residence.png'),
    ).toBeInTheDocument();

    expect(
      screen.getByText('Analyzing Floor Plan ...'),
    ).toBeInTheDocument();
  });
});

it('rejects unsupported file types', () => {
  const { container } = render(<Upload />);

  const input =
    container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    )!;

  const invalidFile = new File(
    ['document'],
    'floor-plan.pdf',
    { type: 'application/pdf' },
  );

  fireEvent.change(input, {
    target: {
      files: [invalidFile],
    },
  });

  expect(
    screen.getByText(
      'Only JPG and PNG floor plans are supported.',
    ),
  ).toBeInTheDocument();
});