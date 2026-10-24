import { z } from 'zod';

export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('scenecraft-api'),
  milestone: z.literal('M0'),
  mode: z.literal('local-foundation'),
});

export type Health = z.infer<typeof healthSchema>;

export type ApiError = {
  error: {
    code: 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR';
    message: string;
    requestId: string;
  };
};
