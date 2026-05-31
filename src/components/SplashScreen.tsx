export const SplashScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-20 w-20">
          <img
            src="/logo-psireal.svg"
            alt="Psi Real"
            className="h-20 w-20 object-contain relative z-10"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div
            className="absolute top-0 left-0 h-20 w-20 rounded-full bg-primary items-center justify-center text-white text-4xl font-bold font-display hidden"
            style={{ background: '#9675CE' }}
          >
            Ψ
          </div>
        </div>
        <h1
          className="text-3xl font-display font-bold tracking-tight"
          style={{ color: '#9675CE' }}
        >
          Psi Real
        </h1>
      </div>

      <div className="mt-10 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#9675CE', animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#9675CE', animationDelay: '150ms' }} />
        <div className="h-2 w-2 rounded-full animate-bounce" style={{ background: '#9675CE', animationDelay: '300ms' }} />
      </div>
    </div>
  );
};
