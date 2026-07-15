import { Check, CheckCheck } from 'lucide-react-native'
import { colors } from '@theme/colors'

// Sent/read ticks on own messages — mirrors web ChatPanel's ReadReceipt.
// The backend flips Message.isRead when the recipient fetches the
// conversation (GET /chat/:id/messages side-effect); there is NO socket
// event announcing reads, so live updates come from the messages query's
// existing poll — same mechanism as web.
// CheckCheck isn't in the shared Icon map, so import lucide directly.
export default function ReadReceipt({ isRead }) {
  const Ticks = isRead ? CheckCheck : Check
  return <Ticks size={13} color={isRead ? colors.white : 'rgba(255,255,255,0.55)'} strokeWidth={2.5} />
}
