import { z } from 'zod';

const HASH_REGEX = /^sha256:[A-Za-z0-9_-]+$/;

const StepSchema = z.object({
  step_id: z.number().int().nonnegative(),
  boundary: z.string().min(1),
  input_hash: z.string().regex(HASH_REGEX, { message: 'input_hash must be sha256:<base64url>' }),
  input: z.any().optional(),
  output: z.any(),
  timestamp: z.string().optional(),
});

const AgentSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

export const RecordSchema = z
  .object({
    version: z.literal('0.1'),
    trace_id: z.string().min(1),
    agent: AgentSchema,
    input: z.any(),
    steps: z.array(StepSchema),
    output: z.any(),
    metadata: z.record(z.any()).optional(),
  })
  .superRefine((rec, ctx) => {
    for (let i = 0; i < rec.steps.length; i++) {
      if (rec.steps[i].step_id !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `step_id must be contiguous starting from 0; step at index ${i} has step_id=${rec.steps[i].step_id}`,
        });
        return;
      }
    }
  });

/**
 * Parse a replay record. Throws ZodError on validation failure.
 */
export function parseRecord(input) {
  return RecordSchema.parse(input);
}
