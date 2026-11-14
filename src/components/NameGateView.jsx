import Button from './ui/Button'
import { Field, Input } from './ui/Field'

export default function NameGateView({
  value,
  onChange,
  onSubmit,
  error,
  maxLength,
  title = 'Bienvenido a Tu día',
  hint,
  submitLabel = 'Empezar',
}) {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-app p-4 text-t1">
      <form
        className="w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        noValidate
      >
        <h1 className="mb-5 text-center text-title font-semibold">{title}</h1>
        <Field label="¿Cómo te llamas?" hint={hint}>
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={maxLength}
            autoFocus
            autoComplete="given-name"
            enterKeyHint="go"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'name-gate-error' : undefined}
          />
        </Field>
        {error && (
          <p id="name-gate-error" role="alert" className="mt-2 text-small text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="mt-5 w-full">
          {submitLabel}
        </Button>
      </form>
    </div>
  )
}
