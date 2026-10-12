import { Router } from 'express';
import { isObjectIdHex } from '../common/mongo.js';
import { toWatchDto } from './watch.js';
import { DuplicateWatchError } from './watch.repository.js';
import { validateCreateWatch } from './watch.validation.js';
import { ProductNotFoundError } from '../products/product.js';
import type { WatchService } from './watch.service.js';

export function createWatchRouter(watches: WatchService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const result = validateCreateWatch(req.body);
    if (!result.ok) {
      res.status(400).json({ errors: result.errors });
      return;
    }

    try {
      const watch = await watches.create(result.value);
      res.status(201).json(toWatchDto(watch));
    } catch (error) {
      // 422: the request is well-formed, but it points to a product that does not exist.
      if (error instanceof ProductNotFoundError) {
        res.status(422).json({ errors: [error.message] });
        return;
      }
      if (error instanceof DuplicateWatchError) {
        res.status(409).json({ errors: [error.message] });
        return;
      }
      throw error;
    }
  });

  router.get('/', async (req, res) => {
    const { productId } = req.query;
    if (productId !== undefined && !isObjectIdHex(productId)) {
      res.status(400).json({ errors: ['productId must be a 24-character hex id'] });
      return;
    }
    const list = await watches.list(productId);
    res.json(list.map(toWatchDto));
  });

  router.delete('/:id', async (req, res) => {
    const deleted = await watches.remove(req.params.id);
    if (!deleted) {
      res.status(404).json({ errors: ['Watch not found'] });
      return;
    }
    res.status(204).end();
  });

  return router;
}