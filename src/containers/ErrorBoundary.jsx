import { Component } from 'react'
import FullScreenMessage from '../components/ui/FullScreenMessage'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error capturado:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <FullScreenMessage
          icon="danger"
          title="Algo salió mal"
          text="Ocurrió un error inesperado en la aplicación."
          actionLabel="Recargar"
          onAction={() => window.location.reload()}
        />
      )
    }
    return this.props.children
  }
}
