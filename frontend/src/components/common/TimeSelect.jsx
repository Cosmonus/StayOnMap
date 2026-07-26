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
}) {
  const options = allowNone
    ? [{ value: '', label: noneLabel }, ...timeOptions(slots)]
    : timeOptions(slots)

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
