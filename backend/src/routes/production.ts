import { Router } from 'express';
import { getProductionLogs, addProductionLog } from '../controllers/production';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/:jobCardId', getProductionLogs);
router.post('/', addProductionLog);

export default router;
