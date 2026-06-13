import { processDueTapSubscriptionRenewals } from '../modules/payments/payments.service.js';

const DEFAULT_RENEWAL_INTERVAL_MS = 5 * 60 * 1000;

const parsePositiveInteger = (value, fallback) => {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
};

const shouldStartWorker = (env = process.env) => {
  if (env.NODE_ENV === 'test') {
    return false;
  }

  if (typeof env.SUBSCRIPTION_RENEWAL_WORKER_ENABLED === 'string') {
    const normalized = env.SUBSCRIPTION_RENEWAL_WORKER_ENABLED.trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return true;
};

export const startSubscriptionRenewalWorker = ({
  env = process.env,
  logger = console,
} = {}) => {
  if (!shouldStartWorker(env)) {
    return {
      started: false,
      stop: () => {},
    };
  }

  const intervalMs = parsePositiveInteger(
    env.SUBSCRIPTION_RENEWAL_INTERVAL_MS,
    DEFAULT_RENEWAL_INTERVAL_MS
  );

  let timer = null;
  let running = false;

  const runOnce = async () => {
    if (running) {
      return null;
    }

    running = true;
    try {
      const result = await processDueTapSubscriptionRenewals();
      if (result.processed > 0 || result.failed > 0 || result.skipped > 0) {
        logger.log(
          `Subscription renewal worker processed ${result.processed} due subscriptions (${result.renewed} renewed, ${result.failed} failed, ${result.skipped} skipped).`
        );
      }
      return result;
    } catch (error) {
      logger.error('Subscription renewal worker failed:', error);
      return null;
    } finally {
      running = false;
    }
  };

  timer = setInterval(() => {
    void runOnce();
  }, intervalMs);
  timer.unref?.();

  void runOnce();

  return {
    started: true,
    intervalMs,
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
};
