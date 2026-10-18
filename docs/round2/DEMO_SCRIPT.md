# Setu demo script (10 minutes, everything live, nothing faked)

## The story in one breath

> A cardiologist in Pune needs a developer for a patient app. On LinkedIn she would cold-message strangers. On Setu she says what she needs in plain words, the network finds the right developer, shows the warmest way in through someone she already trusts, and that person says yes on his phone, live. And no college, hospital or company ever handed over a database.

## Why a mentor will remember it (say these three, in this order)

1. **It is a network, not a directory.** Students, alumni and professionals in different fields, found by *need*: "a doctor can find a developer".
2. **Federated like UPI/Account Aggregator.** Each college and the professional network runs its own server with its own people. Setu only routes. A server can be switched off in one click and its people vanish.
3. **Open by design.** Every server speaks MCP, so any outside AI assistant can query it, and it still cannot see a single name.

## Who and what you need

| Role | Device | Opens |
|---|---|---|
| **P** presenter | Laptop on the projector (Chrome, full screen, zoom 100%) | `https://setu-live-five.vercel.app/live` |
| P, second screen (not projected) | Second laptop or your phone | `https://setu-live-five.vercel.app/stage?key=<DEMO_STAGE_KEY>` |
| **T1** teammate | Phone 1, three tabs | `/live/inbox?as=rahul`, `/live/inbox?as=rohan`, `/live/inbox?as=priya` |
| **T2** teammate | Phone 2, three tabs | `/live/inbox?as=ishaan`, `/live/inbox?as=vikram`, `/live/inbox?as=meera` |
| **M** mentor | Their own phone (optional) | scans a QR; nothing to install |
| Terminal | A second window, font size 18+ | repo folder, ready to run the MCP proof |

No teammates? **Solo mode:** skip the phones. On `/stage` every waiting person has an "open link" button: open it in a new tab, tap Yes. It is the same real flow, just less theatrical.

## Before you start

**T minus 30 min**
1. Open `/stage?key=…`. Press **Warm up**. Wait until **all three lights are green** (the free servers sleep after 15 idle minutes and take up to a minute to wake).
2. In the terminal: `node scripts/e2e-story.mjs https://setu-live-five.vercel.app .env.vercel.production`. Expect **23 of 23 steps passed**. It also resets the demo.
3. In the terminal: `node scripts/mcp-demo.mjs .env.vercel.production`. Expect "0 names in every response".

**T minus 5 min**
1. `/stage` → **Reset demo** (about 2 s). Lights green.
2. T1 and T2 open their tabs and tap **Turn on sound** on the first one.
3. Projector on `/live`. Switch dark mode on (sun button, top right): it reads better across a room.
4. Terminal: clear the screen, command typed but not run.

## The script

Times are targets. **Say** is what you speak. **Proof** is what makes it real, if anyone asks.

### 0:00 · The hook (30 s)
- **Screen:** `/live`. Three server cards (NGIT, RCE, Setu Professionals) with their real web addresses, people counts and green lights, plus the Hub card.
- **Say:** "Every network today says *give us your data*. Colleges won't, hospitals won't. So Setu doesn't ask. This is NGIT's own server in Delhi, RCE's in Noida, and a professional network. Three servers, three owners. The Hub in the middle is a blind router."
- **Hinglish line:** "Data unke paas rehta hai. Setu sirf raasta dikhata hai."
- **Proof:** the addresses on the cards are different servers; click one to show its `/health`.

### 0:30 · A guest joins, live (60 s) · *the audience-participation moment*
- **Do:** on `/stage` press **Show join QR**. The projector shows a big QR. **M** scans it, taps **Professional**, fills the 30-second form (field, role, what they can help with, what they need), taps **I am 18 or older**, **Join Setu**.
- **Say:** "Notice what we ask. Their name stays on the professional server. Setu keeps only a random ID."
- **Screen:** `/live` privacy ticker: "register · received 1 pseudonymous ID, 0 identifying fields".
- **Then:** hide the QR (**Hide the QR**). Say: "Whatever you ticked under *what can you help with*, watch." Open `/live/find` on the projector as any persona and type a need that matches what **M** ticked (for example "I need a lawyer" if they ticked Legal). **M appears in the results**, as a job card with no name.
- **Proof:** M's profile exists only on the professional server; the hub row is one random ID.
- **If no mentor scans:** do it yourself from your phone as "an architect who offers Operations". Same real flow.

### 1:30 · The doctor (Act 1) · Find (60 s)
- **Do:** on `/live`, tap **Dr. Ananya** ("Cardiologist, needs a developer"). You land on **Find**.
- **Screen:** the box is already filled with her own words ("I run a cardiac clinic… I need a developer who has built health apps"). Grey line: *"Filled in from what you told your server. Setu never saw these words."*
- **Say:** "Dr. Ananya saved this on her own server. Her browser read it from there to fill the box. Now she presses **Find them**."
- **Do:** press **Find them**.
- **Screen:** "Asked: NGIT ✓ RCE ✓ Professionals ✓". Best match **Full-stack & ML Developer, Pulse Digital, about 90%** with reasons ("Offers Software, Healthcare", "8 years of experience"). Second: a CTO. Each card shows **"Warmest route: 59.5% chance, through 1 person you trust"**.
- **Say:** "Three servers answered in under a second. She did not search a database. Each server searched its own people and sent back job cards, never names. Setu merged them."
- **Proof:** the search also asked two colleges, so alumni appear too. Different professions, different servers, one answer.

### 2:30 · The best path (60 s)
- **Do:** on the top result press **Ask for intro**.
- **Screen:** the route graph. Dr. Ananya ➜ a trusted CTO ➜ the developer, **59.5%**, against a cold message at **20%**.
- **Say:** "A cold message to a stranger works one time in five. Through someone she already trusts, nearly six in ten. Setu does this maths on every request: it multiplies the chance of each person saying yes and picks the best chain, not the shortest."
- **Do:** press **Draft with AI**. Edit one line. Press **Send**.
- **Say:** "The message text goes to her own server, not to Setu."
- **Proof:** `0.85 × 0.70 = 0.595` is on screen; it is the real product of the two edge probabilities.

### 3:30 · The chain, live (90 s)
- **Do:** **T1** holds up their phone: it buzzes on the **rahul** tab. T1 reads the request aloud, adds a short note ("Ananya is great, Ishaan, worth a call") and taps **Yes, pass it on**.
- **Screen:** the first link turns green and the chance stays visible. Rahul's name appears for Dr. Ananya only now.
- **Say:** "Rahul had to say yes. One tap. If he had said no, Dr. Ananya would never learn who, and Setu would re-route."
- **Do:** on `/stage` press **Show QR: guest plays who is asked**. The projector shows a QR labelled with the person being asked (the developer). **M** scans it, taps **A 15-minute call**, taps **Yes, I'll help**. (Solo: **T2** does it on the **ishaan** tab.)
- **Screen:** the graph turns green end to end; banner **"Ishaan Kapoor · 15-min call"**. The note from the CTO appears.
- **Say:** "The names came straight from the professional server to her browser after both said yes. The hub never held them."
- **Proof:** open `/live/privacy` later: the hub's raw rows contain only random IDs.

### 4:30 · Points and Karz (30 s)
- **Do:** open **Leaderboard**.
- **Say:** "Everyone who said yes just earned Points. Asking costs Karz, a debt. Rank equals Points minus Karz, and Points can't be bought. That is what makes a busy senior say yes."

### 5:00 · The student (Act 2) · Mirror (60 s)
- **Do:** on `/live` tap **Aman**. You land on **Mirror**.
- **Screen:** "6 people were where you are." Top card: **an NGIT alum ’22, ML Engineer at FinStack, 92%**, with *"You both sat in the 7.0–7.5 CGPA band at sem 5, only 19% of seniors did"*. Then → now line.
- **Say:** "Other platforms show where seniors are today. Setu shows where they were when they were exactly like Aman. Her name is hidden. Setu doesn't know it. NGIT's server does."
- **Do:** press **See their path** on the top card to show her timeline.

### 6:00 · A "no" and a re-route (90 s) *(skip this block for the 6-minute version)*
- **Do:** **Bridge** → search **FinStack** → pick **Hiring Manager – ML** → **Send**. (Best path 39.6% against a shortest path of 12%.)
- **Do:** **T1** switches to the **rohan** tab: Yes. **T2** switches to **vikram**: taps **No** then **Decline quietly**.
- **Screen:** a red ✕, "Someone couldn't help, re-routing…", a new path via the NGIT alum at **37.8%**.
- **Say:** "Aman will never know who said no. Setu quietly finds another way."
- **Do:** **T1** on **priya**: Yes. **T2** on **meera**: **A 15-minute call**. Aman's screen: **delivered**.

### 7:30 · Proof 1 · What the hub really holds (30 s)
- **Do:** open **Privacy**.
- **Screen:** the hub's raw database rows on the left (random IDs, roles, titles, scores), a college's own console on the right. Counter: **identifying fields received by the hub: 0**.
- **Say:** "Look for a name. There isn't one. This is the live database, not a mock-up."

### 8:00 · Proof 2 · The kill switch (45 s)
- **Do:** open the professional server's own console in a new tab: `https://setu-college-pro.onrender.com/admin` (password in `node/.env.render-pro`). Press **Hub access OFF**.
- **Screen:** switch to `/live`: the **PROS** light goes red. Go to **Find**: the professionals are gone, the colleges still answer, and the page says the network is offline and its people are not shown.
- **Do:** press **Hub access ON**: back within about a second.
- **Say:** "A hospital or a college can leave at any time. Their people vanish, because Setu never had them."

### 8:45 · Proof 3 · An outside AI reads the network (60 s) · *the "is MCP real?" answer*
- **Do:** in the terminal press Enter on `node scripts/mcp-demo.mjs .env.vercel.production "I need a developer who has built health apps"`.
- **Screen:** step 1, each server answers **HTTP 401** without a key. Step 2, with the key the servers list their own tools. Step 3, each server answers the plain-words need in milliseconds with **identifying_fields = 0**. The last line: **"0 names in every response."**
- **Say:** "This is not our app. This is a separate client, speaking MCP, the open standard that Claude, ChatGPT and Gemini use. Any assistant can ask these servers a question. None of them can get a name."
- **Optional stronger version:** in Claude Code (after running the commands in `.mcp-connect.txt`) ask: *"Use the setu-pro tool match_need to find a developer who has built health apps. Do not guess names."* Claude calls the live server itself.
- **Or in the app:** open **Ask Setu**, press the first example. The right-hand panel shows each call going to each server.

### 9:30 · Close (30 s)
- **Say:** "Setu is UPI for introductions. The college or the hospital is the data provider; Setu is a blind router; every introduction is a one-tap consent. Students pay nothing. Colleges pay for outcome data, professionals for Setu Pro, companies for each warm hire."
- **Hinglish line:** "Ek hi network, har profession ke liye, bina kisi ka data bechke."

## Short versions

- **5 minutes:** hook (0:30) → doctor Find → Bridge → chain (stop at "delivered") → privacy → kill switch → one-line close.
- **3 minutes:** hook → Find → chain → MCP proof.

## If something goes wrong

| Problem | Do this |
|---|---|
| A light is red | `/stage` → **Warm up**, wait about a minute, then **Reset demo**. |
| A teammate's phone doesn't buzz | They open the tab and tap the card, or you use `/stage` → **open link**. |
| No one scans the QR | `/stage` → **Play … on this device**. |
| Wi-Fi dies | Phone hotspot on the laptop and both phones. |
| Gemini is slow | Ask Setu and the draft fall back to offline mode by themselves after 10 s. Say so: "it still works without AI." |
| Anything else | Run `node scripts/e2e-story.mjs https://setu-live-five.vercel.app .env.vercel.production` on the second screen and narrate the 23 passing steps. That is real, but a last resort. |

## What we ask a professional (and where it goes)

| Asked | Where it is stored | Who sees it |
|---|---|---|
| **Field** (Healthcare, Software, Legal, Finance, Design…) | Public job card | Everyone in the network |
| **Role** (for example Cardiologist) and **organisation** | Public job card | Everyone in the network |
| **Years of experience**, **city** | Public job card (years) / their server (city) | Years: network. City: on request |
| **What I can help with** (tags) | Public job card | Everyone: this is what makes them findable |
| **What I need** (tags) | Their own server | Only them; it prefills their search |
| **Open to** (introductions, mentoring, collaboration, hiring, advice, speaking) | Public job card | Everyone |
| **In my own words: what I need or offer** | Their own server | Only people who have said yes to them |
| **Name**, contact, links | Their own server | Only people who have said yes, only after consent |
| **18 or older** (checkbox) | Their own server | Nobody (it only gates sign-up) |

**Not collected:** Aadhaar, salary, licence numbers, photos.
**Next, if a mentor asks about trust:** the professional's server can verify a registration number (for example a medical council number) *on that server* and publish only a "verified" badge, so the hub still never holds the number.
