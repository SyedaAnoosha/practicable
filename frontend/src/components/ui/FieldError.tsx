/** The inline-on-blur message `useFieldValidation` produces. `role="alert"` so a
 * screen-reader user hears it the moment it appears, not only if they happen to tab
 * back over it — same contract as every other inline error in the admin (see the
 * mutation-level `error` blocks in AdminQuestions/AdminTemplates/AdminCourses). */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  )
}
