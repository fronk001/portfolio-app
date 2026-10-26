# Putting the portfolio app on your phone

Three parts, each once. Claude never sees your passwords or keys.

**Before you start:** the cloud engine has to be set up, so there are figures
in Firebase for the app to show. That is `CLOUD-ENGINE.md` in the
**Portfolio tracker** folder. You can do the steps below first, but the app
will say "No figures online yet" until it is done.

---

## 1. Create the repository (GitHub)

The app's code goes in its own public repository, like Gym and Life Hub. It
holds no figures: they stay in Firebase, behind your sign-in.

1. Go to **https://github.com/new**.
2. Repository name: `portfolio-app`. Choose **Public**. Leave everything else
   as it is (no README, no .gitignore, no licence).
3. **Create repository**. Then tell Claude it exists: Claude connects this
   folder to it and sends the code.

## 2. Switch on GitHub Pages

1. In the new repository: **Settings** → **Pages** (left menu).
2. Under *Build and deployment*, **Source**: choose **GitHub Actions**.
3. Open the **Actions** tab. After Claude's push, "Deploy to Pages" runs for
   about a minute; a green tick means the app is online at
   **https://fronk001.github.io/portfolio-app/**.

## 3. Install it on the iPhone

1. Open **https://fronk001.github.io/portfolio-app/** in **Safari**.
2. Share → **Add to Home Screen** → Add. It gets the gold portfolio icon.
3. Open it from the home screen and **sign in there**: the same email and
   password as Life Hub and Gym. (An installed app keeps its own sign-in,
   separate from Safari's.)

From then on it opens straight onto your figures, with or without a
connection, and swaps in newer ones by itself.

If the old gold Portfolio icon (the one that used to open Streamlit) is
still on your home screen, you can remove it once this one works. Since
26 Oct 2026 it opens this app too, but with Safari's bar or a sign-in of
its own. The full tracker stays one tap away at the bottom of the new app.
