import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  LuArrowDown,
  LuCopy,
  LuDownload,
  LuEllipsis,
  LuEllipsisVertical,
  LuHeadphones,
  LuMaximize,
  LuShare,
  LuSquarePlus,
  LuZap,
} from 'react-icons/lu';
import { installWay, useInstall, type InstallWay } from '../../store/install';
import { toast } from '../../store/toast';
import { Bars, Button, Modal } from '../ui';

const isIpad = () => /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A step: its number, what to do, and a small picture of the thing to tap. */
function Step({ n, children, look }: { n: number; children: ReactNode; look?: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl bg-line/[0.04] p-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal to-violet text-[13px] font-bold text-bg">
        {n}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-5 text-ink/90">{children}</span>
      {look && <span className="shrink-0">{look}</span>}
    </li>
  );
}

/** Small copies of what people will see in their browser. */
const Key = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border border-line/15 bg-line/[0.06] px-2.5 text-[13px] font-medium text-[#4a9dff]">
    {children}
  </span>
);

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Link copied');
  } catch {
    toast(location.href);
  }
};

function Steps({ way }: { way: InstallWay }) {
  const ipad = isIpad();
  switch (way) {
    case 'ios-safari':
      return (
        <ol className="space-y-2">
          <Step n={1} look={<Key><LuShare className="text-[17px]" /></Key>}>
            Tap <b>Share</b> {ipad ? 'at the top of Safari' : 'at the bottom of Safari'}
            <span className="block text-[12px] text-faint">On iOS 26, tap ••• first</span>
          </Step>
          <Step n={2} look={<Key><LuSquarePlus className="text-[16px]" /></Key>}>
            Choose <b>Add to Home Screen</b>
            <span className="block text-[12px] text-faint">Scroll down the list if you don’t see it</span>
          </Step>
          <Step n={3} look={<Key>Add</Key>}>
            Tap <b>Add</b>, and Wavee is on your home screen
          </Step>
        </ol>
      );
    case 'ios-browser':
      return (
        <ol className="space-y-2">
          <Step n={1} look={<Key><LuShare className="text-[17px]" /></Key>}>
            Tap <b>Share</b> in the address bar
          </Step>
          <Step n={2} look={<Key><LuSquarePlus className="text-[16px]" /></Key>}>
            Choose <b>Add to Home Screen</b>
          </Step>
          <Step n={3} look={<Key>Add</Key>}>
            Tap <b>Add</b>
          </Step>
        </ol>
      );
    case 'android-menu':
      return (
        <ol className="space-y-2">
          <Step n={1} look={<Key><LuEllipsisVertical className="text-[17px]" /></Key>}>
            Tap the browser’s <b>menu</b>
          </Step>
          <Step n={2} look={<Key><LuDownload className="text-[16px]" /></Key>}>
            Choose <b>Install app</b> or <b>Add to Home screen</b>
          </Step>
          <Step n={3} look={<Key>Install</Key>}>
            Tap <b>Install</b>
          </Step>
        </ol>
      );
    case 'in-app':
      return (
        <>
          <p className="mb-3 text-[14px] leading-5 text-muted">
            You’re in another app’s browser, which can’t install apps. Open Wavee in your phone’s browser first:
          </p>
          <ol className="space-y-2">
            <Step n={1} look={<Key><LuEllipsis className="text-[17px]" /></Key>}>
              Tap <b>•••</b> (or <b>⋮</b>) at the top
            </Step>
            <Step n={2} look={<Key>Open</Key>}>
              Choose <b>Open in browser</b> (or <b>Open in Safari</b>)
            </Step>
            <Step n={3}>Then add Wavee to your home screen from there</Step>
          </ol>
          <Button variant="secondary" className="mt-4 w-full" icon={<LuCopy />} onClick={() => void copyLink()}>
            Copy the link instead
          </Button>
        </>
      );
    case 'mac-safari':
      return (
        <ol className="space-y-2">
          <Step n={1} look={<Key>File</Key>}>
            In Safari’s menu bar, open <b>File</b>
          </Step>
          <Step n={2} look={<Key>Add to Dock</Key>}>
            Choose <b>Add to Dock</b>
          </Step>
        </ol>
      );
    default:
      return (
        <>
          <p className="text-[14px] leading-5 text-muted">
            This browser can’t install apps. Open <b className="text-ink">wavee.kaivon.app</b> in Chrome, Edge or Safari to add it.
          </p>
          <Button variant="secondary" className="mt-4 w-full" icon={<LuCopy />} onClick={() => void copyLink()}>
            Copy the link
          </Button>
        </>
      );
  }
}

/** "Get the Wavee app": one tap where the browser allows it, a short visual guide where it
 * doesn't (iPhone, iPad, in-app browsers). */
export function InstallSheet() {
  const open = useInstall((s) => s.open);
  const close = useInstall((s) => s.close);
  const install = useInstall((s) => s.install);
  const offer = useInstall((s) => s.offer);
  const way = open ? installWay() : 'none';
  const pointDown = way === 'ios-safari' && !isIpad();

  const onInstall = async () => {
    const ok = await install();
    close();
    if (ok) toast('Wavee is on your home screen', 'success');
  };

  return (
    <Modal open={open} onClose={() => close(true)}>
      <div className="flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 220 }}
          className="relative grid h-[76px] w-[76px] place-items-center rounded-[22px] [@media(max-height:720px)]:h-14 [@media(max-height:720px)]:w-14 [@media(max-height:720px)]:rounded-2xl bg-[radial-gradient(95%_95%_at_25%_15%,#1b1f2a,#0a0b10)] shadow-[0_18px_50px_-12px_rgb(var(--violet)/0.55)] ring-1 ring-line/10"
        >
          <Bars playing className="h-9 w-9" />
        </motion.div>
        <h2 className="mt-5 text-[22px] leading-tight">Get the Wavee app</h2>
        <p className="mt-2 max-w-xs text-[14px] leading-5 text-muted">
          Add it to your home screen. It’s free, takes a few seconds, and there’s no app store needed.
        </p>
        <div className="mt-5 grid w-full grid-cols-3 gap-2 text-[12px] leading-4 text-ink/85 [@media(max-height:720px)]:hidden">
          {[
            [<LuZap key="z" />, 'Opens in one tap'],
            [<LuMaximize key="m" />, 'Full screen, like an app'],
            [<LuHeadphones key="h" />, 'Music never far away'],
          ].map(([icon, label]) => (
            <div key={String(label)} className="flex flex-col items-center gap-1.5 rounded-2xl bg-line/[0.04] px-2 py-3">
              <span className="text-[18px] text-teal">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {offer ? (
          <Button variant="brand" size="lg" className="w-full" icon={<LuDownload />} onClick={() => void onInstall()}>
            Install Wavee
          </Button>
        ) : (
          <Steps way={way} />
        )}
      </div>

      <button onClick={() => close(true)} className="mt-4 block w-full py-2 text-center text-sm font-medium text-muted hover:text-ink">
        Not now
      </button>

      {pointDown && (
        <motion.div
          aria-hidden="true"
          className="mt-1 flex flex-col items-center text-[12px] text-faint"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          Safari’s buttons are just below
          <LuArrowDown className="mt-1 text-[18px] text-teal" />
        </motion.div>
      )}
    </Modal>
  );
}
