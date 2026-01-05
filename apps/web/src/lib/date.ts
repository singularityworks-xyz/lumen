export function formatRelativeTime(
  dateString: string,
  options: { short?: boolean } = {}
): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const absDiffMs = Math.abs(diffMs);
  const diffSec = Math.floor(absDiffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const isFuture = diffMs < 0;

  if (diffSec < 60) {
    return "just now";
  }

  if (isFuture) {
    if (diffMin < 60) {
      return `in ${diffMin}m`;
    }
    if (diffHour < 24) {
      return `in ${diffHour}h`;
    }
    if (diffDay === 1 && !options.short) {
      return "tomorrow";
    }
    if (diffDay < 7) {
      return `in ${diffDay}d`;
    }
    return date.toLocaleDateString();
  }

  if (diffMin < 60) {
    return options.short ? `${diffMin}m` : `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return options.short ? `${diffHour}h` : `${diffHour}h ago`;
  }
  if (diffDay === 1 && !options.short) {
    return "yesterday";
  }
  if (diffDay < 7) {
    return options.short ? `${diffDay}d` : `${diffDay}d ago`;
  }
  return date.toLocaleDateString();
}
