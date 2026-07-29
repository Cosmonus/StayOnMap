import { z } from 'zod'

// These routes read `req.body.endpoint` / `req.body.token` / the whole body
// with no schema, so a malformed or absent body reached the service and threw
// — surfacing as a 500 where the caller's request was simply wrong. A 400 is
// the honest answer, and it keeps genuine 5xx meaningful in the logs.

// A Web Push subscription is the browser-generated PushSubscription object.
// `.passthrough()` is deliberate: the shape is defined by the browser, not by
// us, and web-push consumes the whole object — stripping unknown keys here
// would quietly break delivery on any UA that adds a field.
export const webPushSubscribeSchema = z
  .object({
    endpoint: z.string().url().max(2048),
    expirationTime: z.union([z.number(), z.null()]).optional(),
    keys: z.object({
      p256dh: z.string().min(1).max(255),
      auth:   z.string().min(1).max(255),
    }),
  })
  .passthrough()

export const webPushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
})

// Expo tokens look like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]. Matching the
// documented shape keeps junk out of the table that the push sender iterates.
export const expoTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .max(255)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Invalid Expo push token'),
})
