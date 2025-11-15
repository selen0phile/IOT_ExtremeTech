import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

type GoogleLoginButtonProps = {
  className?: string
  children?: React.ReactNode
}

export function GoogleLoginButton({
  className,
  children,
}: GoogleLoginButtonProps) {
  const { signInWithGoogle, isInitializing } = useAuth()

  return (
    <Button
      onClick={signInWithGoogle}
      className={className}
      disabled={isInitializing}
      size="lg"
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontWeight: 600,
        fontSize: '1rem',
        padding: '24px',
        borderRadius: '12px',
        border: 'none',
        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
        transition: 'all 0.3s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)'
      }}
    >
      {children ?? '🚀 Sign in with Google'}
    </Button>
  )
}

export default GoogleLoginButton


