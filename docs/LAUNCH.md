# Launching Wavee: the Founding 100

*October 2026. The plan for Wavee's first 100 members and the first 1,000 after them. It goes with [GROWTH.md](GROWTH.md), the longer business plan.*

## The problem, and the rule

An artist signs up, uploads, and sees zero plays. Their first thought is "nobody is here." That is the cold-start problem, and it kills most music apps before they start.

The answer is to **make Wavee feel alive with real people from day one**, never to pretend it's bigger than it is:

- **No fake plays, accounts or numbers.** The charts already ignore the artist's own plays and paid Boosts. Founding spots on /founding are the real counts.
- **Don't promise listener numbers you can't deliver.** Promise what you control: first listens in the feed, a weekly pick, honest feedback, a personal hello.

The founding story works *because* it's true: people help build something real.

## What's in the app for this

| Feature | Where | What it does for the cold start |
| --- | --- | --- |
| **Founding 100** | /founding, Home banner, profile badge | The first 30 artists and 70 listeners get a numbered gold badge for good. Shows the real spots left. Founders can post their badge as a story card. |
| **First listens** | Automatic on upload | Each artist's first three songs are played to 25 real listeners each in the feed, marked "New artist". No upload goes unheard. They count toward the charts like any feed play. |
| **Fresh Finds** | /picks, Home | The team's weekly picks, each with one line on why. Comes with a story card to post every week. |
| **Feedback** | Song menu, song page, Fresh Finds | Listeners tell the artist what worked ("The hook stuck") and what didn't ("The mix needs work"), privately and anonymously. Artists see it in Stats. |
| **Your week** | Home, for artists | Plays, listeners, new followers, likes, feedback and first listens for the last 7 days, next to the week before. |
| **Weekly challenge** | Home, for listeners | "Find 3 artists you've never heard." Builds a streak shown on the profile (Explorer). |
| **Early finds** | Profile tab | Songs someone liked early, after really listening: their "My Wavee Finds", shareable. |
| **Invites** | Founding page, Your week | Personal links (`/founding?ref=username`). Shows who you brought. |
| **Collections** | Home | Playlists the team features: Hidden Gems, New Artists to Watch… |
| **Team tools** | /admin | **Pulse** (the weekly numbers), **New artists** (everyone whose first song came in, to welcome them), Fresh Finds, Founding 100, Collections. |

Settings live in the `wavee_growth` table (SQL editor):

```sql
update wavee_growth set founding_artists = 30, founding_listeners = 70;  -- the caps
update wavee_growth set founding_open = false;                          -- close it
update wavee_growth set welcome_listeners = 25, welcome_songs = 3;       -- first listens
update wavee_growth set challenge_goal = 3;                             -- the weekly challenge
```

## Before anyone is invited (week 0)

1. Apply the database change (`supabase db push --linked` in the Wavee folder), then deploy the app.
2. **Clean the catalogue.** Hide every test upload of other artists' music (Juice WRLD, Phyno, Dave…). One stolen hit on the front page ruins the pitch to real artists.
3. Make `iamwavee` an admin, official and verified (see the SQL in GROWTH.md).
4. As `iamwavee`, make 3–4 public playlists and feature them in Admin → Collections: *Hidden Gems*, *New Artists to Watch*, *Fresh Nigerian Sounds*, *Gospel Rising*. They can start small.
5. Set up **@waveemusic** (or the closest free name) on Instagram, TikTok and X, and a **WhatsApp Channel**. Post the three launch pictures from `Wavee Growth/Ads` so the accounts aren't empty.
6. Give yourself and anyone helping a founding spot (Admin → Founding 100), and upload your own music if you make it.

## Phase 1: recruit by hand (weeks 1–3)

Goal: **30 founding artists and 70 founding listeners.** If you reach 15 artists and 25 active listeners first, start Phase 2 with them; the numbers are targets, not a gate.

### Artists (10 messages a day)

Where to find them, in this order:

1. **People you know**: friends who make music, producers, church musicians, campus artists.
2. **Campus scenes** (Abuja, Lagos, Ibadan, Nsukka, Zaria): music clubs, talent hunts, hostel artists. One campus artist brings their friends.
3. **Instagram and TikTok**: search `#upcomingartist`, `#naijaartist`, `#afrobeatsartist`, `#abujaartist`, `#lagosartist`, `#gospelartist`, `#amapiano`. Pick artists with 200–5,000 followers who post their own music and reply to comments. They need Wavee most and answer DMs.
4. **Audiomack and Boomplay** "new" lists and SoundCloud: artists already putting music online.
5. **Producers and beatmakers**: each one knows ten artists.
6. **Open mics and showcases**: go in person with the QR poster.

Use the messages in `Wavee Growth/Messages.md`. Never mass-message: one person, one message, by name, mentioning a song of theirs you actually heard.

### The five steps every time an artist joins

Admin → **New artists** lists everyone whose first song came in, with their first-week listeners, first listens and feedback.

1. **Check** the profile and the song. Is it really theirs? If something's off, hide it and ask.
2. **Say hello** within a day (Instagram or WhatsApp). Help them set the hook, add their links, and put their Wavee link in their bio. Mark them *Welcomed* with a note.
3. **Introduce** the song: their first listens start by themselves; if it's good, put it in Fresh Finds with one honest line.
4. **Share** their story: a story card on Wavee's Status and Instagram, tagging them.
5. **Report back** after a week with real numbers from Your week (listeners, feedback, followers). Use the "one week in" message.

At the start you're the distribution. That's fine: the job now is to prove Wavee reliably connects good music with people who want to hear it.

### Listeners (10 invites a day)

Founding listeners promise to explore new artists every week and send honest feedback. Find them among:

- friends who always know new songs first;
- campus groups: music, media and entertainment clubs, hostel WhatsApp groups (ask the admin first);
- DJs, producers and music bloggers (they're listeners too);
- fans of the founding artists (each artist invites five).

Every founder gets a personal invite link. Ask each to bring one more.

## Phase 2: launch week

Pick a date about three weeks out and announce it to the founders.

| Day | What happens |
| --- | --- |
| −7 | Founders get a heads-up: "We go public next Monday. Your badge is ready to post." |
| −3 | Post "Meet the founders" on Instagram: a carousel of 5–10 founding artists (with their permission). |
| Mon (launch) | Founders post their badge cards. Wavee posts the Founding 100 story and the first Fresh Finds. Open /founding publicly for the spots left. |
| Wed | First public Fresh Finds (Admin → Fresh Finds → Story card to post). Tag every artist. |
| Fri | First **Feedback Friday**: in the WhatsApp Channel, share /picks and ask listeners to send each artist feedback in the app. |
| Sun | Look at Pulse. Message every artist their first-week numbers. |

## The weekly rhythm (from launch on)

| Day | Ritual | Tool |
| --- | --- | --- |
| **Monday** | Post the charts: Top 10 and a Rising pick, tagging the artists. | Charts |
| **Wednesday** | **Fresh Finds**: 3–5 songs, one honest line each, posted as a story card. | Admin → Fresh Finds |
| **Friday** | **Feedback Friday**: a discovery session. Share /picks in the Channel and groups and ask for feedback in the app. Shout out the challenge streaks and top tastemakers. | /picks, Charts → Tastemakers |
| **Sunday** | Read **Pulse**. Welcome every new artist. Send last week's artists their numbers. | Admin → Pulse, New artists |

## What to measure (Admin → Pulse)

| Number | Healthy by week 8 | Why it matters |
| --- | --- | --- |
| **Came back**: listeners active this week *and* last | 50+ | The one that matters most. 50 people who come back weekly beat 1,000 accounts. |
| **Heard**: new songs with 5+ listeners in their first week | 80%+ | No artist leaves thinking nobody's here. |
| Listeners (30 s+ on someone else's song) | 150+ | The size of the real audience. |
| Artists whose first song came this week | 10+ | Supply keeps arriving. |
| Feedback sent | 3+ per new song | Artists get value even when the audience is small. |
| Joined from invites | a third of new accounts | Word of mouth is working. |

If **Came back** is flat, work on the feed and Fresh Finds before recruiting more. If **Heard** drops, raise `welcome_listeners` or run more Feedback Fridays.

## From 100 to 1,000

1. **Campus ambassadors.** One founding listener per campus runs a WhatsApp group, posts Fresh Finds, and brings their campus artists. Recognise them on Wavee's socials every month.
2. **Artist-brings-artist.** Ask every artist for two names (Your week has "Bring another artist"). Artists trust other artists.
3. **Monthly contest.** "Wavee Fresh Finds of the Month": the most-loved pick (real listens and feedback) gets a week on Home and a feature post. Later, a sponsor pays for a cash or gear prize.
4. **First-listen drops** for established artists: a song premieres on Wavee a day early, verified badge, announced by both sides (GROWTH.md).
5. **Partners.** Campus radio plays the weekly chart; DJs get credited; showcases put the QR poster on stage.
6. **Video.** A 15-second Reel or TikTok of each week's best hook (the feed already plays from the hook).
7. **Boost and Artist Pro** go live once Flutterwave is verified. Boosted listens never count on the charts, which keeps the charts worth climbing.

## Lines we don't cross

- No fake plays, listeners, followers or founder counts, and no bots. Charts and Pulse only count real listens.
- No promoting music an artist didn't upload themselves.
- Paid placement is always labelled *Promoted*. First listens are labelled *New artist*.
- Ask before using someone's name, photo or music in an ad.
- Ask a group admin before posting in their group. Don't spam.
