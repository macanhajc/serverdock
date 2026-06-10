import webpush from 'web-push';
import { getSettings, saveSettings } from './settingsStore.js';
import logger from './logger.js';

const VAPID_SUBJECT = 'mailto:admin@serverdock.local';

function setVapid() {
  const { vapidPublicKey, vapidPrivateKey } = getSettings();
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey);
  }
}

async function postDiscord(webhookUrl, embeds) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds }),
  });
  if (!res.ok) throw new Error(`Discord responded ${res.status}`);
}

async function sendPush(subscriptions, payload) {
  setVapid();
  const dead = new Set();
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410) dead.add(sub.endpoint);
        else logger.warn({ err, endpoint: sub.endpoint }, 'push notification failed');
      }
    })
  );
  if (dead.size > 0) {
    const { pushSubscriptions = [] } = getSettings();
    await saveSettings({ pushSubscriptions: pushSubscriptions.filter((s) => !dead.has(s.endpoint)) });
  }
}

function exitDetail(exitInfo) {
  if (!exitInfo) return '';
  if (exitInfo.oomKilled) return ' (killed: out of memory)';
  if (exitInfo.error) return ` (${exitInfo.error})`;
  if (exitInfo.exitCode != null && exitInfo.exitCode !== 0) {
    return ` (exit code ${exitInfo.exitCode})`;
  }
  return '';
}

export async function sendCrashNotification(game, exitInfo = null) {
  const detail = exitDetail(exitInfo);
  const { discordWebhookUrl, pushSubscriptions = [] } = getSettings();

  if (discordWebhookUrl?.trim()) {
    try {
      await postDiscord(discordWebhookUrl, [
        {
          title: 'Server Crashed',
          description: `**${game.name}** stopped unexpectedly${detail}.`,
          color: 0xe74c3c,
          timestamp: new Date().toISOString(),
          footer: { text: 'ServerDock' },
        },
      ]);
    } catch (err) {
      logger.warn({ err, gameId: game.id }, 'discord crash notification failed');
    }
  }

  if (pushSubscriptions.length) {
    await sendPush(pushSubscriptions, {
      title: 'Server Crashed',
      body: `${game.name} stopped unexpectedly${detail}.`,
      gameId: game.id,
    });
  }
}

// Generic out-of-band alert (scheduled action failures, etc.) — same channels as crashes
export async function sendEventNotification(title, body, gameId = null) {
  const { discordWebhookUrl, pushSubscriptions = [] } = getSettings();

  if (discordWebhookUrl?.trim()) {
    try {
      await postDiscord(discordWebhookUrl, [
        {
          title,
          description: body,
          color: 0xe74c3c,
          timestamp: new Date().toISOString(),
          footer: { text: 'ServerDock' },
        },
      ]);
    } catch (err) {
      logger.warn({ err, gameId }, 'discord event notification failed');
    }
  }

  if (pushSubscriptions.length) {
    await sendPush(pushSubscriptions, { title, body, gameId });
  }
}

export async function testDiscordWebhook(webhookUrl) {
  await postDiscord(webhookUrl, [
    {
      title: 'ServerDock Test',
      description: 'Discord notifications are working.',
      color: 0x2ecc71,
      timestamp: new Date().toISOString(),
      footer: { text: 'ServerDock' },
    },
  ]);
}

export async function testPushNotification(endpoint) {
  const { pushSubscriptions = [] } = getSettings();
  const targets = endpoint
    ? pushSubscriptions.filter((s) => s.endpoint === endpoint)
    : pushSubscriptions;
  if (!targets.length) throw new Error('No matching subscription');
  await sendPush(targets, {
    title: 'ServerDock Test',
    body: 'Push notifications are working.',
  });
}
