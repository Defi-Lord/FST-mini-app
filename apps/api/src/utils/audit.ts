import { prisma } from "./prisma"; // adjust path if different

export async function ensureWallet(address: string) {
  if (!address) return null;
  const normalized = address.trim();
  let w = await prisma.wallet.findUnique({ where: { address: normalized } });
  if (!w) {
    w = await prisma.wallet.create({ data: { address: normalized } });
  }
  return w;
}

/**
 * logEvent - central audit logging
 * @param params.action - required short string
 * @param params.walletAddress - optional wallet address
 * @param params.userId - optional user.id if known
 * @param params.subject - optional (contestId, tx)
 * @param params.metadata - object for extra fields
 * @param params.req - optional express Request to extract ip/userAgent
 */
export async function logEvent({
  action,
  walletAddress,
  userId,
  subject,
  metadata,
  req
}: {
  action: string;
  walletAddress?: string;
  userId?: string;
  subject?: string;
  metadata?: Record<string, any>;
  req?: any;
}) {
  try {
    let walletId: string | undefined = undefined;
    if (walletAddress) {
      const w = await ensureWallet(walletAddress);
      walletId = w?.id;
    }

    const ip = req?.headers?.['x-forwarded-for']?.split?.(',')?.[0]?.trim()
      || req?.ip || req?.connection?.remoteAddress;

    const userAgent = req?.headers?.['user-agent'] || undefined;

    await prisma.activity.create({
      data: {
        walletId,
        userId,
        action,
        subject,
        metadata: metadata ?? {},
        ip,
        userAgent,
      }
    });
  } catch (err) {
    // don't crash your main flow - log the error to console so you can inspect in Render logs
    console.error('audit.logEvent error', err);
  }
}
