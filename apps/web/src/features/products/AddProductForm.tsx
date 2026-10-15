import { useRef, useState, type FormEvent } from 'react';
import {
  ADD_PRODUCT_MUTATION,
  CATEGORIES,
  type AddProductData,
  type AddProductVariables,
  type Category,
} from '../../api/operations';
import { useMutation } from '../../api/useMutation';
import { ErrorMessage } from '../../shared/ErrorMessage';
import { isHttpUrl } from '../../shared/format';

interface AttributeRow {
  /** Stable React key; the row index would break when a middle row is removed. */
  key: number;
  name: string;
  value: string;
}

interface AddProductFormProps {
  onAdded: (productId: string) => void;
}

export function AddProductForm({ onAdded }: AddProductFormProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<Category>('sport');
  const [attributes, setAttributes] = useState<AttributeRow[]>([]);
  const [validationError, setValidationError] = useState<string>();
  const nextKey = useRef(0);
  const [addProduct, { loading, error }] = useMutation<AddProductData, AddProductVariables>(ADD_PRODUCT_MUTATION);

  function updateAttribute(key: number, patch: Partial<AttributeRow>) {
    setAttributes((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Quick checks for instant feedback; Tracker still validates everything.
    if (!title.trim()) return setValidationError('Enter a title');
    if (!isHttpUrl(url.trim())) return setValidationError('Enter a product page URL starting with http(s)://');
    setValidationError(undefined);

    const data = await addProduct({
      input: {
        title: title.trim(),
        url: url.trim(),
        category,
        attributes: attributes
          .filter((row) => row.name.trim() !== '')
          .map((row) => ({ name: row.name.trim(), value: row.value.trim() })),
      },
    });
    if (!data) return;

    setTitle('');
    setUrl('');
    setAttributes([]);
    onAdded(data.addProduct.id);
  }

  const shownError = validationError ? { message: validationError } : error;

  return (
    <form className="form" onSubmit={(event) => void handleSubmit(event)}>
      <h3>Add product</h3>
      <label>
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        Product page URL
        <input
          type="url"
          value={url}
          placeholder="https://troli.shop/ua/..."
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <label>
        Category
        <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
          {CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="attributes">
        <legend>Attributes (optional)</legend>
        {attributes.map((row) => (
          <div key={row.key} className="attribute-row">
            <input
              aria-label="Attribute name"
              placeholder="color"
              value={row.name}
              onChange={(event) => updateAttribute(row.key, { name: event.target.value })}
            />
            <input
              aria-label="Attribute value"
              placeholder="blue"
              value={row.value}
              onChange={(event) => updateAttribute(row.key, { value: event.target.value })}
            />
            <button
              type="button"
              className="link-button"
              aria-label="Remove attribute"
              onClick={() => setAttributes((rows) => rows.filter((other) => other.key !== row.key))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="link-button"
          onClick={() => setAttributes((rows) => [...rows, { key: nextKey.current++, name: '', value: '' }])}
        >
          + Add attribute
        </button>
      </fieldset>

      {shownError && <ErrorMessage error={shownError} />}
      <button type="submit" disabled={loading}>
        {loading ? 'Adding…' : 'Add product'}
      </button>
    </form>
  );
}
