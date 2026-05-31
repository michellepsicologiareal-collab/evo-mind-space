import logoSrc from "@/assets/logo-psireal.png";

interface LogoIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
}

/**
 * Logo Psi Real usado como ícone decorativo (substitui o `Brain` do lucide).
 * Aceita className para controlar o tamanho (ex.: "h-4 w-4").
 */
export const LogoIcon = ({ className, alt = "", ...rest }: LogoIconProps) => (
  <img
    src={logoSrc}
    alt={alt}
    aria-hidden={alt === "" ? true : undefined}
    draggable={false}
    className={className}
    {...rest}
  />
);
