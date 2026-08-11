// The one time picker. Every place a user chooses a time — booking a visit,
// suggesting another slot, setting the visit window, setting a PG curfew —
// renders this, so all four look and read the same.
//
// It is `Select` underneath for the same reason nothing here uses a bare
// <select>: a native <input type="time"> draws OS chrome that matches no other
// control on the page, and lets someone pick 22:37.
//
// Value in/out is 24-hour "HH:MM" (what the API takes); the list reads 12-hour.
import Select from './Select'
import { ALL_DAY_SLOTS, timeOptions } from '@utils/time'

export default function TimeSelect({
  value,
  onChange,
  label,
  placeholder = 'Select time',
  slots = ALL_DAY_SLOTS,
  allowNone = false,
  noneLabel = 'No curfew',
  disabled = false,
  // Bounds, as "HH:MM". EXCLUSIVE, because both callers so far are the two ends
  // of a window and a window that starts and finishes at the same minute is not
  // one. String comparison is safe on zero-padded 24-hour times, which is why
  // utils/time.js stores them that way.
  after,
  before,
}) {
  // Filtering the LIST rather than validating the answer, deliberately.
  //
  // The backend already rejects an inverted window ("Window start must be
  // before end", properties.validation.js) and the wizard had no matching
  // check — so an owner could pick "visits from 8 PM until 9 AM", finish four
  // more steps, and meet a raw server error at Publish. The fix is not a better
  // error: it is that the option was never offered. .claude/ui-ux.md says the
  // same thing about the listing cap — disable the thing, do not hand someone a
  // rejection.
  const bounded = slots.filter((t) => (!after || t > after) && (!before || t < before))

  const options = allowNone
    ? [{ value: '', label: noneLabel }, ...timeOptions(bounded)]
    : timeOptions(bounded)

  return (
    <Select
      label={label}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      options={options}
      disabled={disabled}
    />
  )
}
