const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { syncOverdueStatus } = require('../utils/loanCalc');
const prisma = new PrismaClient();

const round2 = (n) => Math.round(n * 100) / 100;

function getBatchSize(tenureUnit) {
  if (tenureUnit === 'WEEKS') return 52;
  if (tenureUnit === 'MONTHS') return 12;
  return 365;
}

/**
 * Auto-extend installments for ALL active loans that are running low.
 * Called before fetching repayments so the collection page always has upcoming entries.
 */
async function autoExtendActiveLoans() {
  // Find active loans where unpaid installments are running low
  const activeLoans = await prisma.loan.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, principalAmount: true, interestRate: true, tenureUnit: true },
  });

  for (const loan of activeLoans) {
    const unpaidCount = await prisma.repayment.count({
      where: { loanId: loan.id, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
    });

    if (unpaidCount >= 4) continue;

    const lastInstallment = await prisma.repayment.findFirst({
      where: { loanId: loan.id },
      orderBy: { installmentNo: 'desc' },
    });

    if (!lastInstallment) continue;

    const interestPerPeriod = round2(loan.principalAmount * (loan.interestRate / 100));
    const batchSize = getBatchSize(loan.tenureUnit);
    const startNo = lastInstallment.installmentNo + 1;
    const startFrom = new Date(lastInstallment.dueDate);

    const installments = [];
    for (let i = 0; i < batchSize; i++) {
      const dueDate = new Date(startFrom);
      const offset = i + 1;
      if (loan.tenureUnit === 'MONTHS') dueDate.setMonth(dueDate.getMonth() + offset);
      else if (loan.tenureUnit === 'WEEKS') dueDate.setDate(dueDate.getDate() + offset * 7);
      else dueDate.setDate(dueDate.getDate() + offset);

      installments.push({
        loanId: loan.id,
        installmentNo: startNo + i,
        dueDate,
        dueAmount: interestPerPeriod,
        principal: 0,
        interest: interestPerPeriod,
        status: 'PENDING',
      });
    }

    await prisma.repayment.createMany({ data: installments });

    const newEndDate = installments[installments.length - 1].dueDate;
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        tenure: startNo + batchSize - 1,
        endDate: newEndDate,
      },
    });
  }
}

// GET /api/repayments — list with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { loanId, status, from, to, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (req.user.companyId) {
      where.loan = { companyId: req.user.companyId };
    }
    if (loanId) where.loanId = loanId;
    if (status === 'OVERDUE') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      where.OR = [
        { status: 'OVERDUE' },
        { dueDate: { lt: startOfToday }, status: { in: ['PENDING', 'PARTIAL'] } }
      ];
    } else if (status) {
      where.status = status;
    }

    if (from || to) {
      where.dueDate = {};
      if (from) where.dueDate.gte = new Date(from);
      if (to) where.dueDate.lte = new Date(to);
    }

    // Auto-mark overdue (only starting day after due date)
    await syncOverdueStatus(prisma);

    // Auto-extend runs in background — does NOT block the response
    autoExtendActiveLoans().catch(err => console.error('autoExtend error:', err));

    const [rawRepayments, total] = await Promise.all([
      prisma.repayment.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          loan: { select: { id: true, loanNumber: true, interestType: true, outstandingPrincipal: true, principalAmount: true, customer: { select: { name: true, phone: true, latitude: true, longitude: true } } } },
          payments: { include: { collectedBy: { select: { name: true } } } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.repayment.count({ where }),
    ]);

    const repayments = await Promise.all(rawRepayments.map(async (r) => {
      let isBlocked = false;
      let blockingInstNo = null;
      if (r.installmentNo > 1 && r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD') {
        const unpaidPrev = await prisma.repayment.findFirst({
          where: {
            loanId: r.loanId,
            installmentNo: { lt: r.installmentNo },
            status: { notIn: ['PAID', 'CARRIED_FORWARD'] },
          },
          orderBy: { installmentNo: 'asc' },
          select: { installmentNo: true },
        });
        if (unpaidPrev) {
          isBlocked = true;
          blockingInstNo = unpaidPrev.installmentNo;
        }
      }
      return { ...r, isBlocked, blockingInstNo };
    }));

    res.json({ success: true, data: repayments, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/repayments/today — Today's collections (including overdue for today's active loans)
router.get('/today', authenticate, async (req, res) => {
  try {
    // Auto-mark overdue first (only starting day after due date)
    await syncOverdueStatus(prisma);

    // Auto-extend in background — does NOT block response
    autoExtendActiveLoans().catch(err => console.error('autoExtend error:', err));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Get repayments due today
    const dueTodayRepayments = await prisma.repayment.findMany({
      where: {
        ...(req.user.companyId ? { loan: { companyId: req.user.companyId } } : {}),
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { payments: { some: { collectedAt: { gte: today, lt: tomorrow } } } },
          { paidAt: { gte: today, lt: tomorrow } },
        ]
      },
      select: { loanId: true }
    });

    const activeLoanIds = Array.from(new Set(dueTodayRepayments.map(r => r.loanId)));

    // 2. Fetch all repayments for today + any overdue repayments for those loans
    const rawRepayments = await prisma.repayment.findMany({
      where: {
        ...(req.user.companyId ? { loan: { companyId: req.user.companyId } } : {}),
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { payments: { some: { collectedAt: { gte: today, lt: tomorrow } } } },
          { paidAt: { gte: today, lt: tomorrow } },
          { loanId: { in: activeLoanIds }, status: { in: ['OVERDUE', 'PENDING', 'PARTIAL'] }, dueDate: { lt: today } }
        ]
      },
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            interestType: true,
            outstandingPrincipal: true,
            principalAmount: true,
            agentId: true,
            customer: { select: { name: true, phone: true, address: true, latitude: true, longitude: true } },
          },
        },
        payments: true,
      },
      orderBy: [{ loanId: 'asc' }, { installmentNo: 'asc' }],
    });

    const repayments = await Promise.all(rawRepayments.map(async (r) => {
      let isBlocked = false;
      let blockingInstNo = null;
      if (r.installmentNo > 1 && r.status !== 'PAID' && r.status !== 'CARRIED_FORWARD') {
        const unpaidPrev = await prisma.repayment.findFirst({
          where: {
            loanId: r.loanId,
            installmentNo: { lt: r.installmentNo },
            status: { notIn: ['PAID', 'CARRIED_FORWARD'] },
          },
          orderBy: { installmentNo: 'asc' },
          select: { installmentNo: true },
        });
        if (unpaidPrev) {
          isBlocked = true;
          blockingInstNo = unpaidPrev.installmentNo;
        }
      }
      return { ...r, isBlocked, blockingInstNo };
    }));

    res.json({ success: true, data: repayments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
