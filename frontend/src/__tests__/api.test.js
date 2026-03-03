import { describe, test, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', async () => {
  const actual = await vi.importActual('axios');
  const instance = {
    ...actual.default,
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
    defaults: { withCredentials: false },
  };
  return { default: instance };
});

describe('api.js 401 interceptor', () => {
  let responseInterceptorFulfilled;
  let responseInterceptorRejected;

  beforeEach(async () => {
    vi.resetModules();

    axios.interceptors.response.use.mockImplementation((fulfilled, rejected) => {
      responseInterceptorFulfilled = fulfilled;
      responseInterceptorRejected = rejected;
    });

    await import('../api.js');
  });

  test('dispatches auth:unauthorized event on 401 response', async () => {
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    const error = { response: { status: 401 } };
    await expect(responseInterceptorRejected(error)).rejects.toBe(error);

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:unauthorized', listener);
  });

  test('does not dispatch auth:unauthorized for non-401 errors', async () => {
    const listener = vi.fn();
    window.addEventListener('auth:unauthorized', listener);

    const error = { response: { status: 500 } };
    await expect(responseInterceptorRejected(error)).rejects.toBe(error);

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('auth:unauthorized', listener);
  });

  test('passes through successful responses unchanged', async () => {
    const response = { status: 200, data: { data: [] } };
    const result = responseInterceptorFulfilled(response);
    expect(result).toBe(response);
  });
});
