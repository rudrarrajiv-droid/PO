import { Router } from 'express';
import { getProducts, createProduct } from '../controllers/products';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getProducts);
router.post('/', createProduct);

export default router;
