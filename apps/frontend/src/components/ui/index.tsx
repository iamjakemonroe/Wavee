import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';

// ── Buttons ─────────────────────────────────────────────────────────────

type Variant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:bg-white shadow-[0_8px_30px_-12px_rgba(255,255,255,0.45)]',
  brand: 'bg-brand text-bg shadow-glow-teal hover:brightness-110',
  secondary: 'border border-line/15 bg-line/[0.04] text-ink hover:bg-line/[0.08] hover:border-line/25',
  ghost: 'text-muted hover:bg-line/[0.06] hover:text-ink',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition duration-300 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'h-9 px-4 text-[13px]',
        size === 'md' && 'h-11 px-5 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; size?: 'sm' | 'md' | 'lg' }
>(function IconButton({ label, active, size = 'md', className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full transition duration-200 active:scale-90 disabled:opacity-40',
        size === 'sm' && 'h-8 w-8 text-[17px]',
        size === 'md' && 'h-10 w-10 text-[19px]',
        size === 'lg' && 'h-12 w-12 text-[22px]',
        active ? 'text-teal' : 'text-muted hover:bg-line/[0.07] hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className ?? 'h-5 w-5')}
    />
  );
}

// ── Fields ──────────────────────────────────────────────────────────────

interface FieldProps {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
}

const fieldBase =
  'w-full rounded-xl border bg-line/[0.03] px-4 text-ink placeholder:text-faint transition duration-200 focus:bg-line/[0.05] focus:outline-none';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={fieldId} className="mb-2 block text-[13px] font-medium text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${fieldId}-note` : undefined}
        className={clsx(
          fieldBase,
          'h-12',
          error ? 'border-danger/60 focus:border-danger' : 'border-line/10 focus:border-violet/70',
        )}
        {...rest}
      />
      {(error || hint) && (
        <p id={`${fieldId}-note`} className={clsx('mt-2 text-[13px]', error ? 'text-danger' : 'text-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ label, hint, error, className, id, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <div className={className}>
        {label && (
          <label htmlFor={fieldId} className="mb-2 block text-[13px] font-medium text-muted">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={!!error}
          className={clsx(
            fieldBase,
            'min-h-[110px] resize-y py-3 leading-6',
            error ? 'border-danger/60' : 'border-line/10 focus:border-violet/70',
          )}
          {...rest}
        />
        {(error || hint) && (
          <p className={clsx('mt-2 text-[13px]', error ? 'text-danger' : 'text-faint')}>{error ?? hint}</p>
        )}
      </div>
    );
  },
);

export function Select({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-2 block text-[13px] font-medium text-muted">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(fieldBase, 'h-12 appearance-none border-line/10 bg-[length:16px] focus:border-violet/70')}
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-raised">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-md border border-line/25 bg-line/[0.04] transition checked:border-teal checked:bg-teal checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M3.5 8.5l3 3 6-7%22 fill=%22none%22 stroke=%22%2306070a%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] checked:bg-center"
      />
      <span>{children}</span>
    </label>
  );
}

// ── Dialogs ─────────────────────────────────────────────────────────────

/** A dialog: centred on wide screens, a sheet from the bottom on phones.
 * Escape and the backdrop close it; focus stays inside while it's open. */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panel.current) return;
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('input, textarea, select, button');
      (first ?? panel.current)?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 380 }}
            className={clsx(
              'relative max-h-[calc(100svh-var(--sat)-1rem)] w-full overflow-y-auto rounded-t-4xl border border-line/10 bg-raised p-6 pb-[max(1.5rem,var(--sab))] shadow-lift outline-none sm:max-h-[92svh] sm:rounded-4xl',
              wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
            )}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line/20 sm:hidden" />
            {title && (
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg">{title}</h2>
                <IconButton label="Close" size="sm" onClick={onClose}>
                  <LuX />
                </IconButton>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Pictures and placeholders ───────────────────────────────────────────

/** A cover picture, or a soft gradient made from the title when there's
 * none. */
export function Cover({
  src,
  title,
  className,
  rounded = 'rounded-xl',
}: {
  src: string | null | undefined;
  title: string;
  className?: string;
  rounded?: string;
}) {
  let hash = 0;
  for (const c of title) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return (
    <div className={clsx('relative shrink-0 overflow-hidden bg-raised', rounded, className)}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="grid h-full w-full place-items-center"
          style={{
            background: `radial-gradient(120% 120% at 20% 10%, hsl(${hue} 80% 62% / 0.85), transparent 55%), radial-gradient(100% 100% at 90% 90%, hsl(${(hue + 70) % 360} 80% 55% / 0.8), #0e1015 70%)`,
          }}
        >
          <Bars className="h-1/3 w-1/3 opacity-70" />
        </div>
      )}
    </div>
  );
}

export function Avatar({
  src,
  name,
  className,
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet/70 to-teal/60 font-semibold text-bg',
        className ?? 'h-10 w-10 text-sm',
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        (name.trim()[0] ?? '?').toUpperCase()
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-lg bg-line/[0.05]', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-line/[0.06] to-transparent" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-line/10 bg-line/[0.04] text-2xl text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-base">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── The mark ────────────────────────────────────────────────────────────

/** Five bars of an equaliser, rising teal to violet: Wavee's mark. */
export function Bars({ className, playing }: { className?: string; playing?: boolean }) {
  const heights = [0.45, 0.75, 1, 0.8, 0.55];
  return (
    <span className={clsx('flex items-center justify-center gap-[12%]', className)} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={clsx('w-[11%] origin-center rounded-full', playing && 'animate-eq')}
          style={{
            height: `${h * 100}%`,
            background: `color-mix(in oklab, rgb(var(--teal)) ${100 - i * 25}%, rgb(var(--violet)))`,
            animationDelay: playing ? `${i * -0.18}s` : undefined,
          }}
        />
      ))}
    </span>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-raised ring-1 ring-line/10">
        <Bars className="h-[18px] w-[18px]" />
      </span>
      {!compact && <span className="text-[17px] font-semibold tracking-tight">Wavee</span>}
    </span>
  );
}
