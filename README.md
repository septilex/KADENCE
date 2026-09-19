<div align="center">

<img src="./assets/kadence-horizontal-logo.png" alt="Kadence — Music Beyond Borders" width="820"/>

<br/>

MUSIC BEYOND BORDERS

An immersive music discovery experience where music becomes a visual universe — not another scrolling list. 🎧🌐

Live Demo · GitHub

</div>

✦ What is KADENCE?

KADENCE is an interactive music discovery platform built around a simple idea:

Music discovery should feel spatial, visual, and alive.

Instead of forcing users through static lists, KADENCE turns charts, album artwork, audio previews, and song metadata into a single exploratory interface.

The experience combines:

🎧 Music discovery and curated editorial charts

🌌 A WebGL-powered Music Universe of album artwork

📊 Global, genre, mood, and Indian regional discovery

🎵 30-second audio previews

🪟 Cinematic, liquid-glass song previews

🌈 Artwork-driven visual atmospheres

🔎 Search and chart-based exploration

⚡ Interaction-focused motion and rendering performance

✦ The Experience

flowchart LR
    A["01 · DISCOVER<br/>Music Universe"] --> B["02 · EXPLORE<br/>14 Editorial Charts"]
    B --> C["03 · PREVIEW<br/>Cinematic Song Detail"]
    C --> D["04 · LISTEN<br/>30s Preview / Apple Music"]

    classDef node fill:#0b0b0b,stroke:#cfd3d8,color:#ffffff,stroke-width:1.5px;
    class A,B,C,D node;

The interface is designed as one continuous flow:

DISCOVER → EXPLORE → PREVIEW → LISTEN

✦ 01 — The Music Universe 🌌

The heart of KADENCE is a large interactive Three.js / WebGL artwork field.

Hundreds of album covers form a visual environment that users can explore spatially rather than scrolling through a conventional feed.

<div align="center">
<img src="./assets/Music%20Universe%201.png" alt="KADENCE Music Universe" width="100%"/>
</div>

Interaction model

🖱️ Cursor-mapped exploration

🫧 Continuous surface deformation / motion

🎯 Pin-to-pin cursor interaction

✨ Hover states and focused artwork

🎨 Artwork-rich visual field

⚡ Frame-independent interaction logic

The goal is not to make a decorative canvas.

The canvas is the discovery interface.

✦ 02 — 14 Editorial Charts 📊

KADENCE organizes discovery into 14 editorial worlds:

Global

Genre / Mood

Regional

🌍 Global Top 50

🎤 Hip-Hop Central

🇮🇳 Top Telugu

🔥 Viral 50

✨ Pop Rising

🇮🇳 Top Tamil

🆕 New Music Friday

💃 Dance Hits

🇮🇳 Top Hindi



🌱 Mood Booster

🇰🇷 Top K-Pop



🌙 Late Night





🏋️ Workout





🌊 Chill Hits



Switch Chart

The Switch Chart interaction lets users move between editorial worlds without breaking the discovery experience.

<div align="center">
<img src="./assets/KADENCE%20Switch%20Chart.png" alt="KADENCE Switch Chart" width="860"/>
</div>

✦ 03 — Cinematic Song Preview 🎵

Clicking a track opens a dedicated cinematic Song Preview.

The preview brings together:

album artwork

song title

artist metadata

chart / genre context

waveform

playback controls

preview progress

popularity

Apple Music action

dynamic visual atmosphere

<div align="center">

<img src="./assets/Kurchi%20Song%20Preview.png" alt="Kurchi Song Preview" width="48%"/>
<img src="./assets/Bhoochade%20Song%20Preview.png" alt="Bhoochade Song Preview" width="48%"/>

</div>

✦ 04 — The Interface Adapts to the Song 🌈

KADENCE does not force every song into the same visual environment.

When a track is selected, its artwork drives the surrounding atmosphere.

That creates a simple design principle:

Same interface. Different emotional context.

<div align="center">

<img src="./assets/Ram%20Sita%20Ram%20Song%20Preview.png" alt="Ram Sita Ram Preview" width="48%"/>
<img src="./assets/Dont%20Lose%20Song%20Preview.png" alt="Don't Lose Your Head Preview" width="48%"/>

<br/><br/>

<img src="./assets/Worry%20Song%20Preview.png" alt="Worry Preview" width="31%"/>
<img src="./assets/Love%20Song%20Preview.png" alt="Love Preview" width="31%"/>
<img src="./assets/Sunflower%20Home%20Card%20Preview.png" alt="Sunflower Home Experience" width="31%"/>

</div>

✦ 05 — Global × Regional 🌍🇮🇳

KADENCE is intentionally built around music beyond borders.

The discovery model brings together:

🌍 Global charts

🎤 International genres

🇮🇳 Telugu music

🇮🇳 Tamil music

🇮🇳 Hindi music

🇰🇷 K-Pop

🎧 Mood-based discovery

This creates one discovery environment where regional and global music can coexist.

✦ 06 — Product & UI Philosophy 🪟

KADENCE treats the interface as part of the music experience.

Visual language

Chrome / metallic branding

Liquid-glass surfaces

Cinematic artwork

High-contrast typography

Soft atmospheric blur

Controlled glow

Large visual hierarchy

Minimal but expressive controls

The interface deliberately avoids looking like a conventional streaming dashboard.

The visual environment changes with the music.

✦ 07 — Technical Architecture ⚙️

flowchart TD
    U["USER"]
    F["NEXT.JS / REACT<br/>UI + Interaction"]
    D["iTUNES API<br/>Music & Chart Data"]
    S["STATE + AUDIO<br/>Song Selection / Preview"]
    W["THREE.JS / WEBGL<br/>Music Universe"]
    P["CINEMATIC SONG PREVIEW<br/>Artwork + Controls + Atmosphere"]

    U --> F
    F --> D
    D --> S
    S --> W
    S --> P

    classDef node fill:#f7f7f7,stroke:#111,color:#111,stroke-width:1.5px;
    class U,F,D,S,W,P node;

✦ 08 — Engineering Focus 🧠

KADENCE involved more than visual design. A major part of the project was making an interaction-heavy WebGL experience behave smoothly on desktop and mobile.

Audio performance

Preview playback is treated as a performance-sensitive path so artwork preparation does not unnecessarily delay audio availability.

WebGL performance

The Music Universe required careful control of:

tile count

shader workload

CPU-side deformation

texture updates

frame-dependent animation

Interaction stability

The cursor system was refined to keep the visual deformation aligned with the physical pointer instead of creating a delayed or padded interaction feel.

Motion

Animations use frame-independent interpolation so movement remains stable across changing frame rates.

Glass UI

The Song Preview uses layered translucent surfaces, highlights, shadows, and controlled blur to achieve the liquid-glass visual language.

✦ 09 — Tech Stack 🛠️

Frontend






Visualisation & Motion





Music Data & Development






✦ 10 — Project Structure 🗂️

KADENCE/
├── app/
│   ├── page.tsx
│   └── ...
├── components/
│   ├── universe/
│   ├── ui/
│   ├── SongDetail.tsx
│   ├── GlobalAudioPlayer.tsx
│   └── ...
├── lib/
│   ├── jellyField.ts
│   ├── gridCalc.ts
│   └── ...
├── public/
│   ├── images/
│   ├── videos/
│   └── ...
├── package.json
└── README.md

The exact structure may evolve as the product continues to develop.

✦ 11 — Run KADENCE Locally 💻

Prerequisites

Node.js

npm

Git

Clone

git clone https://github.com/septilex/KADENCE.git
cd KADENCE

Install

npm install

Start development

npm run dev

Open:

http://localhost:3000

Production build

npm run build
npm start

✦ 12 — Roadmap 🔮

KADENCE is still evolving.

Planned directions include:

🤖 AI-powered music recommendations

🧠 Personalised listening intelligence

🌍 Deeper global music-trend analysis

🇮🇳 More Indian regional discovery

🔎 More expressive search

🎙️ AI playlist generation

📱 Mobile-focused experience

👥 Social discovery features

📈 Richer music analytics

✦ 13 — Why KADENCE?

Traditional music interfaces optimise for selection.

KADENCE explores a different model:

make discovery itself the experience.

The product brings data, artwork, sound, motion and interaction into one visual system.

Same beats. A bigger world. 🎧🌐

👨‍💻 Built by Prajit Balaji

KADENCE — MUSIC BEYOND BORDERS

Built with a focus on music discovery, frontend engineering, WebGL experimentation, visual design, and interaction performance.

GitHub · Live Project

<div align="center">

🎵 Explore Music Differently.

</div>
