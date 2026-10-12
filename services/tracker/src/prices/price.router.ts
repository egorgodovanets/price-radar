import { Router, type Request } from 'express';
import { ProductNotFoundError } from '../products/product.js';
import { toPricePointDto } from './price.js';
import { CurrencyMismatchError, type PriceService } from './price.service.js';
import { parseHistoryLimit, validateRecordPrice } from './price.validation.js';

/** :id comes from the mount path /products/:id/prices. */
interface ProductParams {
  id: string;
}

export function createPriceRouter(prices: PriceService): Router {
  // mergeParams: without it this router would not see :id from the parent path.
  const router = Router({ mergeParams: true });

  router.post('/', async (req: Request<ProductParams>, res) => {
    const result = validateRecordPrice(req.body);
    if (!result.ok) {
      res.status(400).json({ errors: result.errors });
      return;
    }

    try {
      const point = await prices.record(req.params.id, result.value);
      res.status(201).json(toPricePointDto(point));
    } catch (error) {
      // 404 (not 422 as in watches): the missing product is the resource in the URL.
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ errors: [error.message] });
        return;
      }
      if (error instanceof CurrencyMismatchError) {
        res.status(422).json({ errors: [error.message] });
        return;
      }
      throw error;
    }
  });

  router.get('/', async (req: Request<ProductParams>, res) => {
    const limit = parseHistoryLimit(req.query.limit);
    if (!limit.ok) {
      res.status(400).json({ errors: limit.errors });
      return;
    }

    try {
      const points = await prices.history(req.params.id, limit.value);
      res.json(points.map(toPricePointDto));
    } catch (error) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ errors: [error.message] });
        return;
      }
      throw error;
    }
  });

  return router;
}