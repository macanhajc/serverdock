import { describe, it, expect } from 'vitest';
import { dockerStateToStatus } from './containers.js';

describe('dockerStateToStatus', () => {
  it('maps a running container to "running"', () => {
    expect(dockerStateToStatus({ State: 'running', Status: 'Up 3 minutes' })).toBe('running');
  });

  it('maps a restarting container to "restarting"', () => {
    expect(dockerStateToStatus({ State: 'restarting', Status: 'Restarting' })).toBe('restarting');
  });

  it('maps a dead container to "error"', () => {
    expect(dockerStateToStatus({ State: 'dead', Status: 'Dead' })).toBe('error');
  });

  it('maps a clean exit (code 0) to "stopped"', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: 'Exited (0) 2 minutes ago' })).toBe(
      'stopped'
    );
  });

  it('treats SIGKILL (137, a docker-stop timeout) as a normal stop, not a crash', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: 'Exited (137) 2 minutes ago' })).toBe(
      'stopped'
    );
  });

  it('treats SIGTERM (143) as a normal stop, not a crash', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: 'Exited (143) 2 minutes ago' })).toBe(
      'stopped'
    );
  });

  it('maps any other nonzero exit code to "error" (an unexpected crash)', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: 'Exited (1) 2 minutes ago' })).toBe(
      'error'
    );
  });

  it('treats a negative exit code as an error too', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: 'Exited (-1) 2 minutes ago' })).toBe(
      'error'
    );
  });

  it('falls back to "stopped" for an exited container whose Status does not parse', () => {
    expect(dockerStateToStatus({ State: 'exited', Status: undefined })).toBe('stopped');
  });

  it('falls back to "stopped" for an unrecognized State (e.g. "created"/"paused")', () => {
    expect(dockerStateToStatus({ State: 'paused', Status: 'Paused' })).toBe('stopped');
  });
});
