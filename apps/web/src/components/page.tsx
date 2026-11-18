export function Page({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <main
      id="main"
      className={`mx-auto w-full px-4 py-8 sm:px-6 sm:py-12 ${narrow ? "max-w-3xl" : "max-w-[70rem]"}`}
    >
      {children}
    </main>
  );
}
