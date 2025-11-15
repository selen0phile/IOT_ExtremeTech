import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

type GoogleLoginButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export function GoogleLoginButton({
  className,
  children,
}: GoogleLoginButtonProps) {
  const { signInWithGoogle, isInitializing } = useAuth();

  return (
    <Button
      onClick={signInWithGoogle}
      className={className}
      disabled={isInitializing}
      size="lg"
      variant="outline"
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.4)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(102, 126, 234, 0.3)";
      }}
    >
      <LogIn className="size-4" />
      {children ?? "Sign in with Google"}
    </Button>
  );
}

export default GoogleLoginButton;
