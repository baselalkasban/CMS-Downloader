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
- Adds a **filter bar** to every course page:
  - **Type** chips (Lecture Slides, Assignment, VoD, ...) with file counts. Pick several at once.
  - **Week** dropdown listing every week of the course.
  - **Search** by file name (press `/` to jump to it).
  - Weeks with no matching files are hidden, and *Download all* only downloads what the filter shows.

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
