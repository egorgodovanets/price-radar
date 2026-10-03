import { Router } from 'express';
import { toProductDto } from './product.js';
import { DuplicateProductError, type ProductRepository } from './product.repository.js';
import { validateCreateProduct } from './product.validation.js';

export function createProductRouter(products: ProductRepository): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const result = validateCreateProduct(req.body);
    if (!result.ok) {
      res.status(400).json({ errors: result.errors });
      return;
    }

    try {
      const product = await products.create(result.value);
      res.status(201).json(toProductDto(product));
    } catch (error) {
      if (error instanceof DuplicateProductError) {
        res.status(409).json({ errors: [error.message] });
        return;
      }
      throw error;
    }
  });

  router.get('/', async (_req, res) => {
    const list = await products.findAll();
    res.json(list.map(toProductDto));
  });

  router.get('/:id', async (req, res) => {
    const product = await products.findById(req.params.id);
    if (!product) {
      res.status(404).json({ errors: ['Product not found'] });
      return;
    }
    res.json(toProductDto(product));
  });

  return router;
}