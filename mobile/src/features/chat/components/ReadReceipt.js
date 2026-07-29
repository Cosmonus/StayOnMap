import { Check, CheckCheck } from 'lucide-react-native'
import { colors } from '@theme/colors'

// Sent / read ticks on your own messages — mirrors web's ReadReceipt.
//
// `Message.isRead` flips when the other person opens the thread, and the backend
// then emits `message:read` to the conversation room (chat.service.js's
// markConversationRead), so this updates live while both sides are on screen.
// ConversationScreen additionally re-fetches the thread when the app returns to
// the foreground, because a socket that dozed can miss that event — an earlier
// version of this comment claimed the messages query polled for it, and there
// has never been such a poll.
//
// 16, not 13: the double tick draws two overlapping strokes across the full
// width of its box, so it loses far more to a small size than a single tick
// does and reads as a smudge rather than as two ticks. 16 is also the floor on
// the icon scale (.claude/ui-ux.md).
//
// 0.75 rather than 0.55 on the unread state: on the brand600 bubble that was
// ~2.2:1, well under the 3:1 a meaning-bearing icon needs — and "delivered but
// not read yet" is the entire meaning of that state.
//
// CheckCheck isn't in the shared Icon map, so import lucide directly.
export default function ReadReceipt({ isRead }) {
  const Ticks = isRead ? CheckCheck : Check
  return <Ticks size={16} color={isRead ? colors.white : 'rgba(255,255,255,0.75)'} strokeWidth={2.5} />
}
