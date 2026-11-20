export function TypingIndicator() {
  return (
    <div className="flex h-6 items-center gap-1.5" aria-label="Thinking">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse-dot"
          style={{ animationDelay: `${index * 0.15}s` }}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">Thinking…</span>
    </div>
  )
}
