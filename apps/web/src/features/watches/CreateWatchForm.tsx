import { useState, type FormEvent } from 'react';
import {
  CREATE_WATCH_MUTATION,
  CURRENCIES,
  type CreateWatchData,
  type CreateWatchVariables,
  type Currency,
} from '../../api/operations';
import { useMutation } from '../../api/useMutation';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { parseAmount } from '../../shared/format';

/** The last used chat id is remembered, so it is typed only once per browser. */
export const CHAT_ID_STORAGE_KEY = 'price-radar.chatId';
const CHAT_ID = /^-?\d{1,20}$/;

interface CreateWatchFormProps {
  productId: string;
  defaultCurrency: Currency;
  onCreated: () => void;
}

export function CreateWatchForm({ productId, defaultCurrency, onCreated }: CreateWatchFormProps) {
  const [chatId, setChatId] = useState(() => localStorage.getItem(CHAT_ID_STORAGE_KEY) ?? '');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [validationError, setValidationError] = useState<string>();
  const [createWatch, { loading, error }] = useMutation<CreateWatchData, CreateWatchVariables>(
    CREATE_WATCH_MUTATION,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (!CHAT_ID.test(chatId.trim())) return setValidationError('Chat id is a number, e.g. 123456789');
    if (parsed === undefined) return setValidationError('Enter a target price greater than 0');
    setValidationError(undefined);

    const data = await createWatch({
      input: { productId, chatId: chatId.trim(), targetPrice: { amount: parsed, currency } },
    });
    if (!data) return;
    localStorage.setItem(CHAT_ID_STORAGE_KEY, chatId.trim());
    setAmount('');
    onCreated();
  }

  const shownError = validationError ? { message: validationError } : error;

  return (
    <form className="form form--inline" onSubmit={(event) => void handleSubmit(event)}>
      <label>
        Telegram chat id
        <input
          inputMode="numeric"
          value={chatId}
          title="Send /start to the bot to get it"
          onChange={(event) => setChatId(event.target.value)}
        />
      </label>
      <label>
        Target price
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <label>
        Currency
        <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
          {CURRENCIES.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Watch'}
      </button>
      {shownError && <ErrorMessage error={shownError} />}
    </form>
  );
}
