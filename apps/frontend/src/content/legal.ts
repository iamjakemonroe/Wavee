/** Wavee's policies. A block is a paragraph, or a list (an array). */
export type Block = string | string[];

export interface LegalDoc {
  slug: 'terms' | 'privacy' | 'refunds' | 'copyright' | 'guidelines';
  title: string;
  summary: string;
  updated: string;
  sections: { heading: string; body: Block[] }[];
}

export const CONTACT = 'wavee@kaivon.app';
/** Takedown notices and counter-notices go here, so they never wait behind other mail. */
export const COPYRIGHT = 'copyright@kaivon.app';
const updated = 'October 23, 2026';
/** The Terms, Privacy and Refund Policy, revised when Boost and Artist Pro arrived. */
const revised = 'October 25, 2026';

export const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: 'The agreement between you and Kaivon when you listen to, upload, share or pay for anything on Wavee.',
  updated: revised,
  sections: [
    {
      heading: 'Who we are',
      body: [
        'Wavee is a place to stream, share and discover music, at wavee.kaivon.app. It is made and run by Kaivon (“we”, “us”), a product studio. By using Wavee you agree to these terms, the Community Guidelines and the Copyright Policy, and when you pay for something, the Refund Policy. If you don’t agree, please don’t use Wavee.',
      ],
    },
    {
      heading: 'Who can use Wavee',
      body: [
        'You must be at least 13 years old. If you are under 18, you need the permission of a parent or guardian, who agrees to these terms for you.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'Give us accurate details and keep your password to yourself: you are responsible for what happens on your account. An account is for one person and can’t be sold or transferred. Your username must not pretend to be someone else or infringe anyone’s rights.',
      ],
    },
    {
      heading: 'Your music stays yours',
      body: [
        'You keep every right you have in the music, artwork, videos and words you upload (“your content”). We don’t buy it and we don’t take ownership of it.',
        'So that Wavee can work, you give Kaivon a worldwide, non-exclusive, royalty-free licence to store, host, copy, convert, stream, display and make your content available on Wavee, and to show it (for example a cover and title) when someone shares a link to it. This licence is only for running, showing and improving Wavee. It ends when you delete the content or your account, except for copies in backups that are removed in the normal course of time.',
      ],
    },
    {
      heading: 'What you promise when you upload',
      body: [
        [
          'You wrote and own the content, or you have every permission needed to upload it, including for samples, beats, lyrics, artwork, photos and video.',
          'Uploading it, and our streaming it as these terms allow, won’t infringe anyone’s copyright, trademark, privacy or other rights.',
          'You are responsible for paying anyone you owe for the content, such as co-writers, producers, featured artists or collecting societies.',
          'The content follows the Community Guidelines, and songs with explicit lyrics are marked explicit.',
        ],
        'If these promises turn out to be untrue, you are responsible for the consequences, and we may remove the content and close your account.',
      ],
    },
    {
      heading: 'Listening',
      body: [
        'Music on Wavee is for your personal, non-commercial listening. Please don’t download, record, rip or redistribute songs unless the artist allows it, and don’t play Wavee in public or commercial spaces as background music.',
        [
          'Don’t inflate plays, likes or follows, for example with bots, scripts or paid schemes (Boost is the only paid way to reach listeners on Wavee). We may remove counts that we believe aren’t real.',
          'Don’t scrape Wavee, interfere with how it works, try to get around its security, or use it to break the law.',
        ],
      ],
    },
    {
      heading: 'Copyright and takedowns',
      body: [
        'We respect the rights of creators. Rights holders can ask us to remove music that infringes their rights, as the Copyright Policy explains. We close the accounts of people who repeatedly upload music they don’t have the rights to.',
      ],
    },
    {
      heading: 'When we remove content or close accounts',
      body: [
        'We may hide or remove content, limit features or suspend or close an account when we believe these terms or the guidelines have been broken, when the law requires it, or to protect listeners, artists or Wavee. Where it’s safe and lawful to, we’ll tell you why. If you think we got it wrong, write to us and we’ll look again.',
        'You can delete your songs at any time, and your whole account from Settings. If you are on Artist Pro, deleting your account cancels it first.',
      ],
    },
    {
      heading: 'Free, and what you can pay for',
      body: [
        'Listening and uploading are free. Artists can choose to pay for two extras, Boost and Artist Pro. What each one includes and its price, in US dollars, are shown before you pay.',
      ],
    },
    {
      heading: 'Boost',
      body: [
        'A Boost plays one of your songs to new listeners in their feed, marked “Promoted”, until it has reached the number of listeners you paid for.',
        [
          'A listener counts once they have really listened (at least 10 seconds), and each person counts once. Your own plays never count.',
          'Boosted listens never count toward the charts or trending, so the charts stay fair for everyone.',
          'How quickly a Boost finishes depends on how many people are listening. We don’t promise how long it takes, or that listeners will like, save or follow.',
          'A Boost runs only while its song is live. If you hide or delete the song, or we remove it for breaking these terms, the Community Guidelines or the Copyright Policy, the Boost stops.',
          'You may boost only songs you have the rights to, and boosted songs must follow the Community Guidelines like any other.',
        ],
      ],
    },
    {
      heading: 'Artist Pro',
      body: [
        'Artist Pro is a monthly membership for artists. It includes a free Boost to 100 listeners each month (an unused one doesn’t carry over), full stats and bigger, lossless uploads. We may add to what it includes.',
        [
          'It renews automatically every month, charged to the card you joined with, until you cancel.',
          'You can cancel any time in Wavee, from Artist Pro › Cancel my plan. Nothing more is charged, and you keep Pro until the end of the month you’ve paid for.',
          'If a renewal payment fails, Pro ends when your paid month does.',
          'If we change the price, we’ll tell you at least 30 days before your first payment at the new price, so you can cancel before then.',
          'Songs you uploaded while a member stay up after Pro ends.',
        ],
      ],
    },
    {
      heading: 'Payments',
      body: [
        'Payments on the web are processed by Flutterwave; we never see your full card details. If your card is in another currency, your bank converts the price and may add its own fee. If you are under 18, you need a parent or guardian’s permission to pay. Refunds follow our Refund Policy.',
      ],
    },
    {
      heading: 'Changes to Wavee',
      body: [
        'Wavee is new and will change as it grows. We may add, change or remove features. If we stop running Wavee, we’ll give you notice so you can keep copies of your own files.',
      ],
    },
    {
      heading: 'Our responsibility to you',
      body: [
        'Wavee is provided “as is”. We work hard to keep it running and safe, but we can’t promise it will always be available or free of errors, or that content others upload is accurate or lawful. As far as the law allows, we aren’t liable for indirect losses, lost profits or lost data, and our total liability to you is limited to what you paid us in the 12 months before the claim. Nothing in these terms limits rights you have that can’t be limited by law.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'We may update these terms. When a change matters, we’ll tell you in the app or by email before it takes effect. Using Wavee after that means you accept the new terms.',
      ],
    },
    {
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of the Federal Republic of Nigeria, and disputes will be handled by the courts of Nigeria. Before going to court, please contact us: most problems are solved quickly that way.',
      ],
    },
    {
      heading: 'Contact',
      body: [`Questions about these terms: ${CONTACT}.`],
    },
  ],
};

export const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: 'What Wavee collects, why, who helps us run it, and the choices you have.',
  updated: revised,
  sections: [
    {
      heading: 'Who is responsible',
      body: [
        `Kaivon is responsible for the personal information Wavee handles. We follow the Nigeria Data Protection Act 2023 and, for people in the European Union or United Kingdom, the GDPR. Contact: ${CONTACT}.`,
      ],
    },
    {
      heading: 'What we collect',
      body: [
        [
          'Your account: your email address, username, name and password (stored only as a secure hash by our sign-in provider).',
          'Your profile: photo, bio and whether you make music, if you add them.',
          'What you upload: songs, cover art, music videos and their details.',
          'What you do on Wavee: songs you play (and roughly how long you listen), where in Wavee you played them (such as the feed or a playlist), likes, follows and playlists.',
          'The country you’re listening from, worked out from your connection when you play a song. Never your precise location.',
          'Payments: if you buy a Boost or Artist Pro, Flutterwave processes the payment and sends us its reference, amount, currency, result and the email used, so we can deliver what you bought, renew or cancel your plan, and handle refunds. We never receive your full card details.',
          'Reports and bug reports you send us, with any email address or screenshot you include, and your browser’s name and version.',
          'Basic technical data our hosting provider records to keep the service secure, such as IP addresses in short-lived logs.',
        ],
        'We don’t use advertising trackers, and we don’t sell your information.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        [
          'To run your account and Wavee itself: sign-in, uploads, streaming, playlists, likes and follows.',
          'To count plays fairly, show what’s trending, and give artists their stats.',
          'To take payments, deliver Boosts and Artist Pro, and handle refunds and fraud.',
          'To recommend music in your feed.',
          'To keep Wavee safe: investigating reports, stopping abuse and fake plays, and handling copyright claims.',
          'To send emails you need, such as confirming your address or resetting your password.',
          'To fix bugs you report and improve Wavee.',
        ],
        'The legal bases are our agreement with you (the Terms), our legitimate interest in keeping Wavee safe and working, legal obligations, and your consent where we ask for it.',
      ],
    },
    {
      heading: 'What others can see',
      body: [
        'Your profile, the songs you upload, your public playlists and your follower counts are public: anyone, including people without an account, can see them, and links to them show a preview when shared. Your email address is never shown to other people. Private playlists are visible only to you.',
        'Artists see totals about their listeners, such as plays, listening time and the countries their listeners are in, never who you are. A country only appears in an artist’s stats once at least 5 of their listeners are there.',
      ],
    },
    {
      heading: 'Who helps us run Wavee',
      body: [
        [
          'Supabase stores our database and runs sign-in (servers in the European Union).',
          'Cloudflare hosts the website and stores uploaded files (servers in Western Europe, delivered through its global network).',
          'An email delivery provider sends sign-in and account emails.',
          'Flutterwave processes payments.',
        ],
        'They process information only on our instructions. When information leaves Nigeria or your country, we rely on safeguards the law recognises.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'We keep your information while your account exists. When you delete your account, we delete your profile, songs, files, playlists, likes and follows; backups are overwritten in the normal course of time. We keep reports and records of copyright claims for as long as we need them to protect people and meet legal duties. A record of each payment (its reference, amount and currency, without your account) is kept for as long as accounting and tax law require.',
      ],
    },
    {
      heading: 'On your device',
      body: [
        'Wavee stores a few things in your browser so it works: your sign-in session and your account details (so Wavee opens straight away), your volume, and a random listening-session number used to count plays fairly. So you stay signed in even if your browser clears its storage, a copy of your sign-in is also kept in a secure cookie that only Wavee’s server can read; signing out removes it. None of this is used for advertising.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        `You can see and change your profile in Settings, and delete your account there at any time. You can also ask us for a copy of your information, ask us to correct or delete it, or object to how we use it, by writing to ${CONTACT}. If you’re unhappy with our answer, you can complain to the Nigeria Data Protection Commission, or to the data protection authority where you live.`,
      ],
    },
    {
      heading: 'Children',
      body: [
        'Wavee is not for children under 13. If we learn we have information about a child under 13, we delete it.',
      ],
    },
    {
      heading: 'Security',
      body: [
        'Information travels encrypted, access to our systems is limited, and our database checks who may read or change every record. No service is perfectly secure, so please use a strong password of your own.',
      ],
    },
    {
      heading: 'Changes',
      body: ['If we change this policy in a way that matters, we’ll tell you before it takes effect.'],
    },
  ],
};

export const refunds: LegalDoc = {
  slug: 'refunds',
  title: 'Refund Policy',
  summary: 'When and how we refund Boosts and Artist Pro.',
  updated: revised,
  sections: [
    {
      heading: 'What you can buy',
      body: [
        'Artists can buy a Boost (one payment, for one song) and Artist Pro (a membership that renews every month). Both are digital services that start as soon as your payment is confirmed. Listening and uploading are free.',
      ],
    },
    {
      heading: 'Always refunded in full',
      body: [
        [
          'You were charged more than once for the same thing.',
          'You were charged but your Boost or Artist Pro never started, and we can’t start it.',
          'A payment was made from your card without your permission (please tell us as soon as you notice).',
          'You were charged after deleting your account.',
        ],
      ],
    },
    {
      heading: 'Boost',
      body: [
        [
          'Changed your mind? Write to us within 24 hours of paying. If the Boost hasn’t reached anyone yet, we refund it in full.',
          'If a Boost hasn’t reached everyone you paid for within 60 days, you can ask for a refund for the listeners it didn’t reach. For example, if it reached half of them, half the price comes back.',
          'If we remove a song by mistake, we put it back and its Boost carries on, or we refund the listeners it didn’t reach, if you prefer.',
          'There’s no refund for listeners not reached if you hide or delete the song yourself, or if we remove the song or close the account for breaking our Terms, Community Guidelines or Copyright Policy.',
          'Likes, follows and saves from a Boost aren’t guaranteed, so they aren’t a reason for a refund.',
          'The free monthly Boost that comes with Artist Pro has no cash value and can’t be refunded.',
        ],
      ],
    },
    {
      heading: 'Artist Pro',
      body: [
        [
          'Cancel any time in Wavee: nothing more is charged, and you keep Pro until the end of the month you’ve paid for. We don’t refund part of a month.',
          'Forgot to cancel? Write to us within 7 days of a renewal. If you haven’t used Pro since it renewed (no free Boost and no lossless uploads), we refund that renewal and end your membership.',
          'If we stop offering Artist Pro, we refund the unused part of your month.',
          'If we close your account for breaking our Terms, Community Guidelines or Copyright Policy, the rest of the month isn’t refunded.',
        ],
      ],
    },
    {
      heading: 'How to ask',
      body: [
        `Write to ${CONTACT} from your account’s email address, with your username, the date and amount, and the payment reference from your receipt. We reply within 3 business days.`,
      ],
    },
    {
      heading: 'How you’re refunded',
      body: [
        'Approved refunds go back to the card you paid with, through Flutterwave, in US dollars. Depending on your bank, the money usually arrives within 5 to 10 business days. If your card is in another currency, your bank’s exchange rate on the day of the refund may differ slightly from the day you paid. A refunded Boost stops, and a refunded Artist Pro membership ends.',
      ],
    },
    {
      heading: 'Before a chargeback',
      body: [
        'If something went wrong with a payment, please contact us first: it’s the fastest way to fix it. While a chargeback is reviewed, we may pause paid features on the account.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'Nothing in this policy affects rights you have under consumer protection law, including the Federal Competition and Consumer Protection Act of Nigeria, or the law where you live.',
      ],
    },
  ],
};

export const copyright: LegalDoc = {
  slug: 'copyright',
  title: 'Copyright Policy',
  summary: 'How rights holders can ask us to remove music, and what happens next.',
  updated,
  sections: [
    {
      heading: 'Our approach',
      body: [
        'Everyone who uploads to Wavee confirms they own the music or have permission to share it. When that isn’t true, we act quickly on valid notices from rights holders, and we close the accounts of repeat infringers.',
      ],
    },
    {
      heading: 'Report an infringement',
      body: [
        `The fastest way is the Report option in the ••• menu on the song, choosing “Copyright”. You can also email ${COPYRIGHT} with “Copyright notice” in the subject. Please include:`,
        [
          'The work you own (for example the song’s title, the artist and a link to the original).',
          'The link to the song on Wavee.',
          'Your name, and whether you are the owner or act for them.',
          'An email address where we can reach you.',
          'A statement that you believe in good faith that the use isn’t allowed by the owner, their agent or the law.',
          'A statement that your notice is accurate and that you are the owner or authorised to act for them.',
        ],
      ],
    },
    {
      heading: 'What happens next',
      body: [
        'We review notices promptly, usually within two working days. When a notice is complete and valid, we remove or hide the song and tell the person who uploaded it, including who made the claim and how to reach them so they can resolve it.',
      ],
    },
    {
      heading: 'If your song was removed by mistake',
      body: [
        `If you believe a song was removed because of a mistake or a wrong identification, or you have permission to use it, write to ${COPYRIGHT} with the song’s title, why you believe the claim is wrong, your name and email, and a statement that what you say is true. We share counter-notices with the claimant and may restore the song if they don’t take the matter further.`,
      ],
    },
    {
      heading: 'Repeat infringers',
      body: [
        'Each valid claim counts as a strike against the uploader’s account. Accounts with repeated strikes are closed, and the person may not open a new one.',
      ],
    },
    {
      heading: 'False claims',
      body: [
        'Please only send notices for work you own or represent. Knowingly false notices or counter-notices can have legal consequences, and we may ignore notices from people who misuse this process.',
      ],
    },
  ],
};

export const guidelines: LegalDoc = {
  slug: 'guidelines',
  title: 'Community Guidelines',
  summary: 'Wavee is for music and the people who make and love it. These are the house rules.',
  updated,
  sections: [
    {
      heading: 'Share your own music',
      body: [
        'Upload songs you made or have the rights to share, with artwork and videos you have permission to use. Don’t upload other artists’ releases, rips, or remixes and covers that you don’t have permission for.',
      ],
    },
    {
      heading: 'Be honest',
      body: [
        [
          'Don’t pretend to be another artist, label or person. The verified badge is given only by Wavee, after we confirm an artist is who they say they are.',
          'Don’t fake plays, likes or follows, or pay for them.',
          'Use titles, genres and descriptions that match the music: no misleading tags or spam.',
        ],
      ],
    },
    {
      heading: 'Respect people',
      body: [
        [
          'No hate: nothing that attacks people for their race, ethnicity, religion, nationality, disability, sex, gender, sexual orientation or similar characteristics.',
          'No harassment, bullying, threats or sharing someone’s private information.',
          'No content that promotes terrorism or glorifies serious violence.',
        ],
      ],
    },
    {
      heading: 'Keep it safe',
      body: [
        [
          'Nothing that sexualises minors, ever. We remove it and report it to the authorities.',
          'No sexually explicit or graphic violent cover art or videos.',
          'Nothing that promotes self-harm, or illegal activity such as selling drugs or weapons.',
        ],
        'Strong language is part of a lot of music and is welcome, but mark songs with explicit lyrics as explicit.',
      ],
    },
    {
      heading: 'Reporting',
      body: [
        'If something breaks these rules, use Report in the song’s or person’s ••• menu. Reports are private: the person you report isn’t told who reported them.',
      ],
    },
    {
      heading: 'What we do',
      body: [
        'Depending on what happened, we may hide or remove content, limit an account, or close it. Serious harm or repeated breaks lead to closing the account straight away.',
      ],
    },
  ],
};

export const legalDocs = { terms, privacy, refunds, copyright, guidelines };
