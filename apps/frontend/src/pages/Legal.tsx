import clsx from 'clsx';
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { CONTACT, legalDocs, type LegalDoc } from '../content/legal';

const order: { slug: LegalDoc['slug']; label: string }[] = [
  { slug: 'terms', label: 'Terms' },
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'copyright', label: 'Copyright' },
  { slug: 'guidelines', label: 'Guidelines' },
];

export function Legal({ slug }: { slug: LegalDoc['slug'] }) {
  const doc = legalDocs[slug];
  useEffect(() => {
    document.title = `${doc.title} · Wavee`;
    return () => {
      document.title = 'Wavee';
    };
  }, [doc.title]);

  return (
    <div className="animate-rise mx-auto max-w-3xl pb-10 pt-4">
      <nav className="mb-10 flex gap-1 overflow-x-auto rounded-full border border-line/[0.08] bg-line/[0.03] p-1 sm:inline-flex" aria-label="Policies">
        {order.map((o) => (
          <NavLink
            key={o.slug}
            to={`/${o.slug}`}
            className={({ isActive }) =>
              clsx('shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition', isActive ? 'bg-ink text-bg' : 'text-muted hover:text-ink')
            }
          >
            {o.label}
          </NavLink>
        ))}
      </nav>
      <p className="label">Updated {doc.updated}</p>
      <h1 className="mt-3 text-4xl">{doc.title}</h1>
      <p className="mt-4 text-lg leading-8 text-muted">{doc.summary}</p>
      <article className="prose-legal mt-4">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((block, i) =>
              Array.isArray(block) ? (
                <ul key={i}>
                  {block.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{block}</p>
              ),
            )}
          </section>
        ))}
      </article>
      <p className="mt-12 border-t border-line/[0.06] pt-6 text-[13px] text-faint">
        Wavee is a Kaivon product. Questions: <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a>
      </p>
    </div>
  );
}
