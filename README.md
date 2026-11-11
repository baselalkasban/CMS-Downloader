# CMS-Downloader
A Chrome extension for the GUC CMS that makes downloading course content easy.

## What it does
- **Renames each download to its title.** If you click *Download Content* on
  "1 - PA01 Propositional Logic (solution)", the file is saved as
  `PA01 Propositional Logic (solution).pdf`, not `GUC_124_70_70318_2026-09-06T12_14_39.pdf`.
- **Puts each file in a folder named after its course**, inside your Downloads folder:
  ```
  Downloads/
  └── CMS Pro/
      ├── Mathematics V (Discrete Math)/
      │   ├── PA01 Propositional Logic (solution).pdf
      │   └── PA02 Arguments, Inference & Equivalence Rules (solution).pdf
      ├── Digital System Design/
      └── Data Base I/
  ```
- Adds a **Download all** button to every course page. It clicks every *Download Content* button
  in the weeks currently shown (so it follows the CMS week/tag filters), and the files are marked as seen on the CMS.
  The first time, Chrome asks to allow *multiple downloads* from cms.guc.edu.eg; click **Allow**.
- **Pro view**: a cleaner redesign of the whole CMS (switch back any time with *Classic view*).
  - **Every page** gets a restyled header, sidebar (with real course names), tables, cards, buttons, forms and dialogs.
  - **8 themes**: Midnight Amber, Ocean Depths, Midnight Galaxy, Tech Innovation, Forest Canopy (dark) and
    Arctic Frost, Modern Minimalist, Botanical Garden (light). Pick one in the extension popup or with Ctrl+K.
  - **Command palette (Ctrl+K)** on any CMS page: jump to a course, a CMS page, a group chat, any week or any file
    (files from courses you've opened at least once), or switch theme. Picking a file opens its preview directly.
  - **Keyboard shortcuts**: press `?` to see them all.
  - **Home page**: quick links to every CMS page, *Continue where you left off* (your recently opened files), a card per course showing how many files you've opened (progress bar), what's new,
    and its latest update; a *New for you* list of files you haven't opened; and a tidy activity feed grouped by day.
    Click any card or item to open that course.
  - **Course pages**:
    - A week navigator on the side: numbered weeks with their dates and topics, the current week
      highlighted, and a dot on weeks with new files.
    - A compact file list with file-type icons, colored type labels and a *New* badge on files you haven't opened.
    - One-click *Download*, *Open in a new tab* and *Watch* (for videos), plus *Download week* and *Download all/shown*.
    - **Click a file's name to preview it** (PDFs, images, videos) in a window titled with the file's name.
      Use ← / → to go through files and Esc to close. *Open in a new tab* also shows the real file name as the tab title.
    - **5-star ratings** under every file, saved to the CMS. Click the same star again to remove your rating.
    - Search (press `/`), type filters, *New only*, newest/oldest week order, collapsible weeks (J / K to move between them),
      the course announcement at the top, a course switcher and a link to the course's group chat.
- In *Classic view*, course pages get a filter bar (type, week, search) instead.

- **Outlook mail (mail.guc.edu.eg)**:
  - **Short subjects**: `[EXTERNAL EMAIL] - Notification System: Tomorrows Math 501 tutorial [Group: Winter 2026 - MATH 501 - 5MET27 (Tutorial)]`
    becomes **Tomorrows Math 501 tutorial** with a small `MATH 501 · 5MET27 (Tutorial)` tag (the tag can be turned off in the popup).
  - **Real senders**: emails from "GUC Notification System (DO NOT REPLY)" show the person who signed them
    (the lines after the `-----` line), e.g. **Ms. Mai Adel Mohamed Ibrahim · Mathematics**, in the reading pane,
    and in the inbox list for emails you've opened at least once.
  - **Dark Outlook**: with a dark theme picked, Outlook is repainted dark to match (can be turned off in the popup).
    Attachments and embedded documents always keep their real colors.
  - **Bolder text**: Outlook's thin fonts are drawn heavier so emails are easier to read (can be turned off in the popup).
  - **Mail assistant** panel (same themes as the CMS):
    - *Key details* pulled out of the email without AI: slots and rooms ("2nd slot · C5.212"), dates, times, deadlines and links.
    - *AI summary* from an AI running **on your own computer**: a one-line summary, when, where, what to do, and key points.
      The email never leaves your device.
    - *Favorites*: star an email to keep it with its summary and full text; search them and jump back to them in Outlook.

## Local AI for mail summaries
1. Install [Ollama](https://ollama.com/download) (or [LM Studio](https://lmstudio.ai) and start its local server).
2. Download a model, e.g. in a terminal: `ollama pull llama3.2` (small and fast) or `ollama pull qwen2.5:7b` (better summaries, needs more memory).
3. In the extension popup, under *Local AI*, click **Test**, then pick the model.
   Ollama's address is `http://localhost:11434`; LM Studio's is `http://localhost:1234`.

No extra Ollama configuration is needed: the extension sends its requests without the browser-extension
origin that Ollama would otherwise refuse.

## Install
1. Download this repository (green **Code** button → *Download ZIP*) and unzip it somewhere permanent,
   e.g. `Documents\CMS-Downloader`. Chrome loads the extension from this folder, so don't delete it.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the `extension` folder.
4. Open the CMS and click *Download Content* on any item.

> If Chrome asks where to save every file, turn off
> *Settings → Downloads → Ask where to save each file before downloading*.
> Otherwise the save dialog opens with the renamed file already filled in.

## Updating
No need to download from GitHub again:
1. Double-click **`update.bat`** in the CMS-Downloader folder. It downloads the latest version into the `extension` folder.
2. Click the extension icon in Chrome and press **Reload extension**.

Your settings are kept. The extension popup also tells you when a new version is available.

## Settings
Click the extension icon to change:
- **Folder inside Downloads**: `CMS Pro` by default. Use `/` for subfolders, e.g. `CMS Pro/SEM 5`.
- **Keep course code in folder name**: `CSEN605 Digital System Design` instead of `Digital System Design`.
- **Keep item number in file name**: `1 - PA01 ...` instead of `PA01 ...`.

## Notes
- Chrome extensions can only save inside your Downloads folder, so the base folder is always under it.
- Course names are read from the course page and remembered from the CMS home page.
  A file downloaded without clicking *Download Content* (for example from *View Content*)
  still goes into its course folder but keeps its original name.
- If a file with the same name already exists, Chrome adds a number, e.g. `PA01 ... (1).pdf`.

## Development
Theme colors are generated: edit the table in `tools/themes.py`, then run `python3 tools/themes.py extension`
to rewrite `extension/themes.css` and `extension/lib/themes.js`.
