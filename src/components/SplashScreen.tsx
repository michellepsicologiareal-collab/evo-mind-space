export const SplashScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/logo-psireal.png"
          alt="Psi Real"
          className="h-20 w-20 object-contain"
        />
        <h1
          className="text-3xl font-display font-bold tracking-tight text-primary"
          style={{ color: "#9675CE" }}
        >
          Psi Real
        </h1>
      </div>

      <div className="mt-10 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
};
