import { Router } from 'express';
import { getReels, createReelTransaction } from '../controllers/reels';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', getReels);
router.post('/transaction', createReelTransaction);

export default router;
