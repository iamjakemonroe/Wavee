import { useState } from 'react';
import { LuLogOut } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { usePlayer } from '../../store/player';
import { toast } from '../../store/toast';
import { Button, Modal } from '../ui';

/** "Sign out of Wavee?" before anything happens. Signing out stops the music and goes home. */
export function SignOutConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAuth((s) => s.account);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      if (usePlayer.getState().playing) usePlayer.getState().toggle();
      await signOut();
      onClose();
      navigate('/');
      toast('You’re signed out');
    } catch {
      toast('We couldn’t sign you out. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Sign out of Wavee?">
      <p className="text-sm leading-6 text-muted">
        {account ? (
          <>
            You’re signed in as <b className="text-ink">@{account.username}</b>. Your library, playlists and uploads stay safe:
            sign back in anytime.
          </>
        ) : (
          'Your library, playlists and uploads stay safe: sign back in anytime.'
        )}
      </p>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Stay signed in
        </Button>
        <Button variant="danger" className="flex-1" icon={<LuLogOut />} loading={busy} onClick={() => void confirm()}>
          Sign out
        </Button>
      </div>
    </Modal>
  );
}
