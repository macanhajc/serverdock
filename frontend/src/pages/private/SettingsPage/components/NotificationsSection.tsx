import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Send } from 'pixelarticons/react';
import { useToast } from '../../../../context/ToastContext';
import { Button } from '../../../../components/core/Button';
import { TextField } from '../../../../components/forms/TextField';
import { SettingsCard } from './SettingsCard';
import { settingsErrorMessage } from '../hooks/settingsApi';
import { useTestDiscord } from '../hooks/useTestDiscord';
import { usePushState } from '../hooks/usePushState';
import { useSubscribePush } from '../hooks/useSubscribePush';
import { useUnsubscribePush } from '../hooks/useUnsubscribePush';
import { useTestPush } from '../hooks/useTestPush';

export function NotificationsSection({
  discordWebhookUrl,
  savedDiscordWebhookUrl,
  canManage,
  onDiscordChange,
  vapidPublicKey,
  open,
  onToggle,
  dirty,
}: {
  discordWebhookUrl: string;
  savedDiscordWebhookUrl: string;
  canManage: boolean;
  onDiscordChange: (value: string) => void;
  vapidPublicKey: string;
  open: boolean;
  onToggle: () => void;
  dirty: boolean;
}) {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const testDiscord = useTestDiscord();
  const push = usePushState();
  const subscribePush = useSubscribePush(vapidPublicKey);
  const unsubscribePush = useUnsubscribePush();
  const testPush = useTestPush();

  function handleTestDiscord() {
    testDiscord.mutate(undefined, {
      onSuccess: () => addToast(t('settings.discordTestSent')),
      onError: (err) => addToast(settingsErrorMessage(err, t('settings.discordTestFailed')), 'error'),
    });
  }

  function handlePushSubscribe() {
    subscribePush.mutate(undefined, {
      onSuccess: ({ permission, subscription }) => {
        push.setPermission(permission);
        if (!subscription) return;
        push.setSubscription(subscription);
        addToast(t('settings.pushSubscribed'));
      },
      onError: (err) => addToast(settingsErrorMessage(err, t('settings.pushTestFailed')), 'error'),
    });
  }

  function handlePushUnsubscribe() {
    if (!push.subscription) return;
    unsubscribePush.mutate(push.subscription, {
      onSuccess: () => {
        push.setSubscription(null);
        addToast(t('settings.pushNotSubscribed'));
      },
      onError: (err) => addToast(settingsErrorMessage(err, t('settings.pushTestFailed')), 'error'),
    });
  }

  function handleTestPush() {
    testPush.mutate(push.subscription?.endpoint, {
      onSuccess: () => addToast(t('settings.pushTestSent')),
      onError: (err) => addToast(settingsErrorMessage(err, t('settings.pushTestFailed')), 'error'),
    });
  }

  return (
    <SettingsCard
      icon={<Bell width={14} height={14} />}
      title={t('settings.notificationsTitle')}
      description={t('settings.notificationsDesc')}
      open={open}
      onToggle={onToggle}
      dirty={dirty}
    >
      <div className="flex flex-col gap-6">
        {/* Discord */}
        <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
          <h3 className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
            {t('settings.discordTitle')}
          </h3>
          <p className="m-0 text-xs text-ink-3">{t('settings.discordDesc')}</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <TextField
                label={t('settings.discordLabel')}
                hint={t('settings.discordHint')}
                mono
                disabled={!canManage}
                placeholder={t('settings.discordPlaceholder')}
                value={discordWebhookUrl}
                onChange={(e) => onDiscordChange(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!canManage || !savedDiscordWebhookUrl || testDiscord.isPending}
              onClick={handleTestDiscord}
            >
              {testDiscord.isPending ? (
                '…'
              ) : (
                <>
                  <Send width={12} height={12} className="mr-1.5" />
                  {t('settings.discordTest')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Browser Push */}
        <div className="flex border border-dashed bg-line/10 border-line-2 p-4 flex-col gap-3">
          <h3 className="font-mono text-xs text-ink font-semibold uppercase tracking-wider">
            {t('settings.pushTitle')}
          </h3>
          <p className="m-0 text-xs text-ink-3">{t('settings.pushDesc')}</p>
          {!push.supported ? (
            <div className="font-mono text-xs text-ink-3">{t('settings.pushNotSupported')}</div>
          ) : push.permission === 'denied' ? (
            <div className="font-mono text-xs text-yellow">
              {t('settings.pushPermissionDenied')}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-3">
                {push.subscription ? t('settings.pushSubscribed') : t('settings.pushNotSubscribed')}
              </span>
              {push.subscription ? (
                <>
                  <Button size="sm" disabled={testPush.isPending} onClick={handleTestPush}>
                    {testPush.isPending ? (
                      '…'
                    ) : (
                      <>
                        <Bell width={12} height={12} className="mr-1.5" />
                        {t('settings.pushTest')}
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={unsubscribePush.isPending}
                    onClick={handlePushUnsubscribe}
                  >
                    <BellOff width={12} height={12} className="mr-1.5" />
                    {t('settings.pushUnsubscribe')}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={subscribePush.isPending || !vapidPublicKey}
                  onClick={handlePushSubscribe}
                >
                  {subscribePush.isPending ? (
                    '…'
                  ) : (
                    <>
                      <Bell width={12} height={12} className="mr-1.5" />
                      {t('settings.pushSubscribe')}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
