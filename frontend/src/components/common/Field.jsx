import { useId } from 'react'

// Owns the parts of a form field that are not the control: the label, the hint,
// the error, and the wiring that connects them to it.
//
// It exists because that wiring was never done. Fields across the app render a
// <p className="text-xs text-slate-500"> under an input and call it a hint —
// visually it is one, but nothing associates the two, so a screen reader reads
// the input with no hint and no error at all. The user most likely to need the
// explanation is the one who never gets it.
//
// Pass a render function so the control receives the generated ids:
//
//   <Field label="Phone" hint="We only share this with the owner" error={err}>
//     {(p) => <input {...p} value={v} onChange={...} className={INPUT} />}
//   </Field>
//
// `error` replaces `hint` in the description when present — announcing both
// makes the reader listen through the advice to reach the problem.
export default function Field({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  className = '',
  children,
}) {
  const auto = useId()
  const id = htmlFor ?? auto
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const controlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-2">
          {label}
          {required && (
            <>
              {' '}
              <span className="text-red-600" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </>
          )}
        </label>
      )}

      {typeof children === 'function' ? children(controlProps) : children}

      {error ? (
        // role="alert" so a validation failure is announced when it appears,
        // not only when focus happens to land back on the field.
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
