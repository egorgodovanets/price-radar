import { useState, type FormEvent } from 'react';
import {
  CURRENCIES,
  RECORD_PRICE_MUTATION,
  type Currency,
  type RecordPriceData,
  type RecordPriceVariables,
} from '../../api/operations';
import { useMutation } from '../../api/useMutation';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { parseAmount } from '../../shared/format';

interface RecordPriceFormProps {
  productId: string;
  defaultCurrency: Currency;
  onRecorded: () => void;
}

/** Normally the scraper records prices; this form does the same by hand. */
export function RecordPriceForm({ productId, defaultCurrency, onRecorded }: RecordPriceFormProps) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [validationError, setValidationError] = useState<string>();
  const [recordPrice, { loading, error }] = useMutation<RecordPriceData, RecordPriceVariables>(
    RECORD_PRICE_MUTATION,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAmount(amount);
    if (parsed === undefined) return setValidationError('Enter a price greater than 0');
    setValidationError(undefined);

    const data = await recordPrice({ productId, price: { amount: parsed, currency } });
    if (!data) return;
    setAmount('');
    onRecorded();
  }

  const shownError = validationError ? { message: validationError } : error;

  return (
    <form className="form form--inline" onSubmit={(event) => void handleSubmit(event)}>
      <label>
        New price
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
        {loading ? 'Saving…' : 'Record price'}
      </button>
      {shownError && <ErrorMessage error={shownError} />}
    </form>
  );
}
