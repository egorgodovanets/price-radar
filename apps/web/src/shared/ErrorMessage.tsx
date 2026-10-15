interface ErrorMessageProps {
  error: { message: string };
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  return (
    <p role="alert" className="error">
      {error.message}
      {onRetry && (
        <button type="button" className="link-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </p>
  );
}
