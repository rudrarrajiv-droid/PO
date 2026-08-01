import { Router } from 'express';
import { getCustomers, createCustomer } from '../controllers/customers';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Protect all customer routes
router.use(authenticate);

router.get('/', getCustomers);
router.post('/', createCustomer);

export default router;
