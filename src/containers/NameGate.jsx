import { useState } from 'react'
import NameGateView from '../components/NameGateView'
import { MAX_NAME_LENGTH, NAME_REQUIRED_ERROR } from '../lib/constants'

export default function NameGate({ onSave, error: externalError = '', ...viewProps }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleChange = (next) => {
    setValue(next)
    if (error) setError('')
  }

  const handleSubmit = () => {
    if (!value.trim()) {
      setError(NAME_REQUIRED_ERROR)
      return
    }
    setError('')
    onSave(value.trim())
  }

  return (
    <NameGateView
      value={value}
      onChange={handleChange}
      onSubmit={handleSubmit}
      error={error || externalError}
      maxLength={MAX_NAME_LENGTH}
      {...viewProps}
    />
  )
}
