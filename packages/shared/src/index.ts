import { z } from 'zod';

export const RECOMMENDED_SCENE_MODEL_ID = 'gpt-6.1-sol';

export const healthSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('scenecraft-api'),
  milestone: z.literal('M8'),
  mode: z.literal('local-only'),
});

export type Health = z.infer<typeof healthSchema>;

export type ApiError = {
  error: {
    code: 'NOT_FOUND' | 'FORBIDDEN' | 'INTERNAL_ERROR';
    message: string;
    requestId: string;
  };
};
