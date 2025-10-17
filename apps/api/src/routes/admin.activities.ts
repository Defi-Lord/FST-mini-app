import express from 'express';
import { prisma } from '../utils/prisma';
import { isAdmin } from '../middleware/admin'; // you said you have admin middleware
const router = express.Router();

/**
 * GET /admin/activities
 * query params:
 *   page, perPage, action, wallet, contestId, from, to
 */
router.get('/activities', isAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string || '1'));
  const perPage = Math.min(100, parseInt(req.query.perPage as string || '25'));
  const where: any = {};
  if (req.query.action) where.action = req.query.action;
  if (req.query.wallet) {
    const w = await prisma.wallet.findUnique({ where: { address: String(req.query.wallet) } });
    if (w) where.walletId = w.id;
    else {
      return res.json({ total: 0, items: [] });
    }
  }
  if (req.query.contestId) where.subject = String(req.query.contestId);
  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(String(req.query.from));
    if (req.query.to) where.createdAt.lte = new Date(String(req.query.to));
  }

  const total = await prisma.activity.count({ where });
  const items = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage
  });

  return res.json({ total, page, perPage, items });
});

export default router;
