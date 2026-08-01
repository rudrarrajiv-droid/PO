import { Router } from 'express';
import { getJobCards, createJobCard, downloadJobCardPDF, getNextJobCardNo } from '../controllers/jobcards';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/next-number', getNextJobCardNo);
router.get('/', getJobCards);
router.post('/', createJobCard);
router.get('/:id/pdf', downloadJobCardPDF);

export default router;
