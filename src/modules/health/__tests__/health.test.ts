import request from 'supertest';
import { createApp } from '../../../app';

const app = createApp();

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  it('should include app metadata in the response', async () => {
    const res = await request(app).get('/health');

    expect(res.body.data).toHaveProperty('app');
    expect(res.body.data).toHaveProperty('version');
    expect(res.body.data).toHaveProperty('environment');
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('should return a valid ISO timestamp', async () => {
    const res = await request(app).get('/health');
    const { timestamp } = res.body.data as { timestamp: string };

    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});

describe('GET /unknown-route', () => {
  it('should return 404 for undefined routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        message: expect.stringContaining('not found'),
      },
    });
  });
});
