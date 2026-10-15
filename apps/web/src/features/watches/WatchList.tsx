import {
  DELETE_WATCH_MUTATION,
  type DeleteWatchData,
  type DeleteWatchVariables,
  type Watch,
} from '../../api/operations';
import { useMutation } from '../../api/useMutation';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { formatMoney } from '../../shared/format';

interface WatchListProps {
  watches: Watch[];
  onDeleted: () => void;
}

export function WatchList({ watches, onDeleted }: WatchListProps) {
  if (watches.length === 0) return <p className="muted">Nobody watches this product yet.</p>;

  return (
    <ul className="watch-list">
      {watches.map((watch) => (
        <WatchItem key={watch.id} watch={watch} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}

/** Own component, so each row has its own "deleting…" state. */
function WatchItem({ watch, onDeleted }: { watch: Watch; onDeleted: () => void }) {
  const [deleteWatch, { loading, error }] = useMutation<DeleteWatchData, DeleteWatchVariables>(
    DELETE_WATCH_MUTATION,
  );

  async function handleDelete() {
    // false means someone else already deleted it; the list needs a refresh either way.
    const data = await deleteWatch({ id: watch.id });
    if (data) onDeleted();
  }

  return (
    <li>
      <span>
        Chat {watch.chatId}: notify at {formatMoney(watch.targetPrice)} or less
      </span>
      <button
        type="button"
        className="link-button"
        disabled={loading}
        aria-label={`Delete watch for chat ${watch.chatId}`}
        onClick={() => void handleDelete()}
      >
        {loading ? 'Deleting…' : 'Delete'}
      </button>
      {error && <ErrorMessage error={error} />}
    </li>
  );
}
